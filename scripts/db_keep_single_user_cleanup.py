#!/usr/bin/env python3

import os
import uuid
from pathlib import Path

import psycopg2
import psycopg2.extras

KEEP_EMAIL = "amirhossain.limon@gmail.com"


def cuid_like() -> str:
    return "c" + uuid.uuid4().hex[:23]


def load_database_url() -> str:
    if os.getenv("DATABASE_URL"):
        return os.environ["DATABASE_URL"]

    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        raise RuntimeError("DATABASE_URL not found in env and .env file is missing")

    for line in env_path.read_text().splitlines():
        if line.startswith("DATABASE_URL="):
            return line.split("=", 1)[1].strip()

    raise RuntimeError("DATABASE_URL not found in .env")


def count(cur, table: str) -> int:
    cur.execute(f'SELECT count(*) FROM "{table}"')
    row = cur.fetchone()
    return row["count"]


def main() -> None:
    db_url = load_database_url()

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        cur.execute('SELECT id, "tenantId", email FROM users WHERE email = %s LIMIT 1', (KEEP_EMAIL,))
        keep_user = cur.fetchone()
        if not keep_user:
            raise RuntimeError(f"Keep user {KEEP_EMAIL} not found")

        keep_user_id = keep_user["id"]
        keep_tenant_id = keep_user["tenantId"]

        print(f"Keeping user: {keep_user['email']} ({keep_user_id})")
        print(f"Keeping tenant: {keep_tenant_id}")

        cur.execute('SELECT id FROM users WHERE id <> %s', (keep_user_id,))
        delete_user_ids = [row["id"] for row in cur.fetchall()]

        cur.execute('SELECT id FROM tenants WHERE id <> %s', (keep_tenant_id,))
        delete_tenant_ids = [row["id"] for row in cur.fetchall()]

        print(f"Users to delete: {len(delete_user_ids)}")
        print(f"Tenants to delete: {len(delete_tenant_ids)}")

        # Delete high-churn operational/test data first.
        for table in [
            "webhook_logs",
            "execution_logs",
            "usage_logs",
            "activity_logs",
            "newsletter_subscribers",
            "data_deletion_requests",
            "onboarding_milestone_events",
            "onboarding_sessions",
            "leads",
            "internal_notes",
            "crm_messages",
            "webchat_events",
            "webchat_sessions",
            "crm_conversations",
            "flow_sessions",
            "flow_channel_assignments",
            "flow_assignments",
            "flow_nodes",
            "flows",
            "contact_identities",
            "contacts",
            "facebook_pages",
            "webchat_sites",
            "channels",
            "bots",
            "oidc_models",
        ]:
            cur.execute(f'DELETE FROM "{table}"')

        # Remove user auth data for all non-kept users.
        if delete_user_ids:
            cur.execute('DELETE FROM accounts WHERE "userId" = ANY(%s)', (delete_user_ids,))
            cur.execute('DELETE FROM sessions WHERE "userId" = ANY(%s)', (delete_user_ids,))

        # Remove per-tenant settings for non-kept tenants before tenant deletion.
        if delete_tenant_ids:
            cur.execute('DELETE FROM tenant_channel_statuses WHERE "tenantId" = ANY(%s)', (delete_tenant_ids,))
            cur.execute('DELETE FROM tenant_lead_notification_settings WHERE "tenantId" = ANY(%s)', (delete_tenant_ids,))
            cur.execute('DELETE FROM subscriptions WHERE "tenantId" = ANY(%s)', (delete_tenant_ids,))

        # Delete all users except the one to keep.
        cur.execute('DELETE FROM users WHERE id <> %s', (keep_user_id,))

        # Delete all tenants except the one to keep.
        cur.execute('DELETE FROM tenants WHERE id <> %s', (keep_tenant_id,))

        # Ensure kept user still points to kept tenant.
        cur.execute('UPDATE users SET "tenantId" = %s WHERE id = %s', (keep_tenant_id, keep_user_id))

        # Ensure required seed plans exist and are correct.
        plan_defs = [
            ("free", "Free", 0.0, "GBP", 100, 3000, 100, 1, 1, 100, 3),
            ("starter", "Starter", 19.0, "GBP", 1000, 30000, 1000, 3, 3, 1000, 10),
            ("pro", "Pro", 49.0, "GBP", 5000, 150000, 5000, 10, 5, 5000, 50),
            ("business", "Business", 99.0, "GBP", 20000, 600000, 20000, 50, 10, 20000, 999),
        ]

        for (
            name,
            display_name,
            price,
            currency,
            daily_limit,
            monthly_limit,
            flow_cap,
            max_bots,
            max_channels,
            max_conversations,
            max_flows,
        ) in plan_defs:
            cur.execute(
                '''
                INSERT INTO plans (
                  id, name, "displayName", price, currency,
                  "dailyMessageLimit", "monthlyMessageLimit", "flowExecutionCap",
                  "maxBots", "maxChannelsPerBot", "maxConversations", "maxFlows",
                  features, "createdAt", "updatedAt"
                ) VALUES (
                  %s, %s, %s, %s, %s,
                  %s, %s, %s,
                  %s, %s, %s, %s,
                  '{}'::json, NOW(), NOW()
                )
                ON CONFLICT (name) DO UPDATE SET
                  "displayName" = EXCLUDED."displayName",
                  price = EXCLUDED.price,
                  currency = EXCLUDED.currency,
                  "dailyMessageLimit" = EXCLUDED."dailyMessageLimit",
                  "monthlyMessageLimit" = EXCLUDED."monthlyMessageLimit",
                  "flowExecutionCap" = EXCLUDED."flowExecutionCap",
                  "maxBots" = EXCLUDED."maxBots",
                  "maxChannelsPerBot" = EXCLUDED."maxChannelsPerBot",
                  "maxConversations" = EXCLUDED."maxConversations",
                  "maxFlows" = EXCLUDED."maxFlows",
                  "updatedAt" = NOW()
                ''',
                (
                    cuid_like(),
                    name,
                    display_name,
                    price,
                    currency,
                    daily_limit,
                    monthly_limit,
                    flow_cap,
                    max_bots,
                    max_channels,
                    max_conversations,
                    max_flows,
                ),
            )

        # Keep one subscription for the remaining tenant on free plan.
        cur.execute("SELECT id FROM plans WHERE name = 'free' LIMIT 1")
        free_plan = cur.fetchone()
        if not free_plan:
            raise RuntimeError("Free plan not found after plan seeding")

        free_plan_id = free_plan["id"]

        cur.execute('DELETE FROM subscriptions WHERE "tenantId" = %s', (keep_tenant_id,))
        cur.execute(
            '''
            INSERT INTO subscriptions (
              id, "stripeId", "stripeCustomerId", status,
              "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd",
              "trialEndsAt", "planId", "tenantId", "createdAt", "updatedAt"
            ) VALUES (
              %s, %s, NULL, 'active',
              NOW(), NOW() + INTERVAL '30 days', false,
              NOW() + INTERVAL '14 days', %s, %s, NOW(), NOW()
            )
            ''',
            (cuid_like(), f"seed_sub_{cuid_like()}", free_plan_id, keep_tenant_id),
        )

        # Ensure remaining tenant has default channel status/settings.
        cur.execute('DELETE FROM tenant_channel_statuses WHERE "tenantId" = %s', (keep_tenant_id,))
        cur.execute(
            '''
            INSERT INTO tenant_channel_statuses
            (id, "tenantId", facebook, telegram, webchat, whatsapp, "createdAt", "updatedAt")
            VALUES (%s, %s, false, true, true, false, NOW(), NOW())
            ''',
            (cuid_like(), keep_tenant_id),
        )

        cur.execute('DELETE FROM tenant_lead_notification_settings WHERE "tenantId" = %s', (keep_tenant_id,))
        cur.execute(
            '''
            INSERT INTO tenant_lead_notification_settings
            (id, "tenantId", "emailRecipients", "telegramChatIds", "createdAt", "updatedAt")
            VALUES (%s, %s, '[]'::json, '[]'::json, NOW(), NOW())
            ''',
            (cuid_like(), keep_tenant_id),
        )

        # Keep a healthy system health row.
        cur.execute("DELETE FROM system_health WHERE system <> 'ai-engine'")
        cur.execute(
            '''
            INSERT INTO system_health (id, system, "isHealthy", "lastChecked", details)
            VALUES (%s, 'ai-engine', true, NOW(), NULL)
            ON CONFLICT (system) DO UPDATE SET
              "isHealthy" = true,
              "lastChecked" = NOW(),
              details = NULL
            ''',
            (cuid_like(),),
        )

        conn.commit()

        print("Cleanup committed. Final key counts:")
        for t in [
            "users",
            "tenants",
            "plans",
            "subscriptions",
            "demo_templates",
            "bots",
            "channels",
            "flows",
            "flow_nodes",
            "flow_sessions",
            "contacts",
            "crm_conversations",
            "crm_messages",
            "webhook_logs",
            "execution_logs",
            "usage_logs",
            "activity_logs",
            "data_deletion_requests",
            "newsletter_subscribers",
            "tenant_channel_statuses",
            "tenant_lead_notification_settings",
        ]:
            print(f"  {t}: {count(cur, t)}")

    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
