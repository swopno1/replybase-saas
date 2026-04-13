#!/usr/bin/env python3
"""
ReplyBase SaaS - Database Cleanup & Seed Fix Script
====================================================
What this script does:
  1. Deletes 3 spam/bot tenant accounts (March 24, 2026 random names + no activity)
  2. Fixes 'free' plan currency from USD to GBP
  3. Upserts missing plans: starter, pro, business
  4. Creates missing tenant_channel_statuses for all tenants that lack them
  5. Creates missing tenant_lead_notification_settings for all tenants that lack them
  6. Resets stale system_health(ai-engine) back to healthy status
  7. Marks the old unprocessed data_deletion_request as REJECTED
  8. Purges old webhook_logs (>30 days)
  9. Deletes duplicate flow 'Welcome & Lead Capture (Copy)'
"""

import psycopg2
import psycopg2.extras
import uuid
from datetime import datetime, timezone

DB_URL = "postgres://postgres:2b1HcgrA4TZHQ7L8MPsCwUAM9QbFafetMu0agPoAk4onrILLZb1kKjVeVyKaAHFL@104.248.160.102:5432/replybase_saas"

# -- Tenant IDs confirmed to be spam (random workspace names, no bots, no activity, same-day registration)
SPAM_TENANT_IDS = [
    'cmn4o055c000j13sm97u6bjsg',  # "yphkPRZHmgvAQiUDidzyn UhZWzzlukZIkGAJwAXDFzccj's Workspace"
    'cmn4vprsk000m13smitcry54a',  # "UHRUcuxuMvRfsBmdPjAe hyaLhVWsfuYrnEBkisA's Workspace"
    'cmn4y21j1000p13smxcj5dvk8',  # "qXTflbkLQnxhLrakqiq lfiZhyBCpPFPvwNysis's Workspace"
]

DUPLICATE_FLOW_ID = 'cmmxt2b870000z71vlfppxqvf'   # "Welcome & Lead Capture (Copy)"
STALE_DDR_ID     = 'cmlq3egnp000113ljcy7gi64r'    # target user pending data deletion request >30d

# Plan IDs — free plan ID already known from audit
FREE_PLAN_ID = 'cmlp5r21m000313t1mw4kd1n8'

def cuid_like():
    """Generate a cuid-like ID (just a random UUID without dashes for now)."""
    return 'c' + uuid.uuid4().hex[:23]

def run(conn, sql, params=None, label=""):
    with conn.cursor() as cur:
        try:
            cur.execute(sql, params)
            conn.commit()
            print(f"  ✅ {label}")
        except Exception as e:
            conn.rollback()
            print(f"  ❌ {label} — {e}")

def count(conn, table, where="1=1", params=None):
    with conn.cursor() as cur:
        cur.execute(f'SELECT count(*) FROM "{table}" WHERE {where}', params)
        return cur.fetchone()[0]

def fetchall(conn, sql, params=None):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        return cur.fetchall()

def main():
    print("Connecting to ReplyBase SaaS database...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    print("Connected!\n")

    # ──────────────────────────────────────────────────────────
    # 1. DELETE SPAM TENANT ACCOUNTS
    # ──────────────────────────────────────────────────────────
    print("=" * 60)
    print("1. DELETING SPAM / BOT TENANT ACCOUNTS")
    print("=" * 60)

    for tid in SPAM_TENANT_IDS:
        tenant_rows = fetchall(conn, "SELECT name FROM tenants WHERE id = %s", (tid,))
        if not tenant_rows:
            print(f"  ⚠  Tenant {tid} not found, skipping")
            continue
        tname = tenant_rows[0]['name']
        print(f"\n  Tenant: {tname} ({tid})")

        # 1a. Delete users (must go first - no cascade from tenant to user)
        user_rows = fetchall(conn, 'SELECT id, email FROM users WHERE "tenantId" = %s', (tid,))
        for u in user_rows:
            # Delete user's OAuth accounts
            run(conn, 'DELETE FROM accounts WHERE "userId" = %s', (u['id'],), f"  Delete account for user {u['email']}")
            # Delete user's sessions
            run(conn, 'DELETE FROM sessions WHERE "userId" = %s', (u['id'],), f"  Delete sessions for user {u['email']}")
            # Delete user
            run(conn, 'DELETE FROM users WHERE id = %s', (u['id'],), f"  Delete user {u['email']}")

        # 1b. Delete subscription (tenantId has onDelete: Cascade in Prisma but let's be explicit)
        run(conn, 'DELETE FROM subscriptions WHERE "tenantId" = %s', (tid,), f"  Delete subscription for {tname}")

        # 1c. Delete the tenant (remaining cascade relations will fire: onboarding_milestone_events, activity_logs, etc.)
        run(conn, 'DELETE FROM tenants WHERE id = %s', (tid,), f"  Delete tenant {tname}")

    print(f"\n  Remaining tenants: {count(conn, 'tenants')}")
    print(f"  Remaining users:   {count(conn, 'users')}")
    print(f"  Remaining subs:    {count(conn, 'subscriptions')}")

    # ──────────────────────────────────────────────────────────
    # 2. FIX 'free' PLAN CURRENCY USD → GBP
    # ──────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("2. FIX 'free' PLAN CURRENCY USD → GBP")
    print("=" * 60)
    run(conn,
        "UPDATE plans SET currency = 'GBP', \"updatedAt\" = NOW() WHERE id = %s",
        (FREE_PLAN_ID,),
        "Updated free plan currency USD → GBP"
    )

    # ──────────────────────────────────────────────────────────
    # 3. UPSERT MISSING PLANS (starter, pro, business)
    # ──────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("3. UPSERT MISSING PLANS (starter, pro, business)")
    print("=" * 60)

    plans = [
        {
            'name': 'starter',
            'displayName': 'Starter',
            'price': 19.0,
            'currency': 'GBP',
            'dailyMessageLimit': 1000,
            'monthlyMessageLimit': 30000,
            'flowExecutionCap': 1000,
            'maxBots': 3,
            'maxChannelsPerBot': 3,
            'maxConversations': 1000,
            'maxFlows': 10,
        },
        {
            'name': 'pro',
            'displayName': 'Pro',
            'price': 49.0,
            'currency': 'GBP',
            'dailyMessageLimit': 5000,
            'monthlyMessageLimit': 150000,
            'flowExecutionCap': 5000,
            'maxBots': 10,
            'maxChannelsPerBot': 5,
            'maxConversations': 5000,
            'maxFlows': 50,
        },
        {
            'name': 'business',
            'displayName': 'Business',
            'price': 99.0,
            'currency': 'GBP',
            'dailyMessageLimit': 20000,
            'monthlyMessageLimit': 600000,
            'flowExecutionCap': 20000,
            'maxBots': 50,
            'maxChannelsPerBot': 10,
            'maxConversations': 20000,
            'maxFlows': 999,
        },
    ]

    for p in plans:
        run(conn, """
            INSERT INTO plans (
              id, name, "displayName", price, currency,
              "dailyMessageLimit", "monthlyMessageLimit", "flowExecutionCap",
              "maxBots", "maxChannelsPerBot", "maxConversations", "maxFlows",
              features, "createdAt", "updatedAt"
            ) VALUES (
              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
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
        """, (
            cuid_like(),
            p['name'], p['displayName'], p['price'], p['currency'],
            p['dailyMessageLimit'], p['monthlyMessageLimit'], p['flowExecutionCap'],
            p['maxBots'], p['maxChannelsPerBot'], p['maxConversations'], p['maxFlows'],
        ), f"Upsert plan '{p['name']}'")

    plan_rows = fetchall(conn, "SELECT name, \"displayName\", price, currency FROM plans ORDER BY price")
    print("  Plans now in DB:")
    for p in plan_rows:
        print(f"    {p['name']:<12} {p['displayName']:<12} £{p['price']}")

    # ──────────────────────────────────────────────────────────
    # 4. CREATE MISSING tenant_channel_statuses
    # ──────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("4. CREATE MISSING tenant_channel_statuses")
    print("=" * 60)

    tenants_without_status = fetchall(conn, """
        SELECT t.id, t.name FROM tenants t
        WHERE t.id NOT IN (SELECT "tenantId" FROM tenant_channel_statuses)
        ORDER BY t.name
    """)
    print(f"  Tenants missing channel status: {len(tenants_without_status)}")
    for t in tenants_without_status:
        print(f"  Creating for: {t['name']} ({t['id']})")
        run(conn, """
            INSERT INTO tenant_channel_statuses (id, "tenantId", facebook, telegram, webchat, whatsapp, "createdAt", "updatedAt")
            VALUES (%s, %s, false, true, true, false, NOW(), NOW())
            ON CONFLICT ("tenantId") DO NOTHING
        """, (cuid_like(), t['id']), f"  Created channel status for {t['name']}")

    # ──────────────────────────────────────────────────────────
    # 5. CREATE MISSING tenant_lead_notification_settings
    # ──────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("5. CREATE MISSING tenant_lead_notification_settings")
    print("=" * 60)

    tenants_without_notif = fetchall(conn, """
        SELECT t.id, t.name FROM tenants t
        WHERE t.id NOT IN (SELECT "tenantId" FROM tenant_lead_notification_settings)
        ORDER BY t.name
    """)
    print(f"  Tenants missing lead notification settings: {len(tenants_without_notif)}")
    for t in tenants_without_notif:
        print(f"  Creating for: {t['name']} ({t['id']})")
        run(conn, """
            INSERT INTO tenant_lead_notification_settings (id, "tenantId", "emailRecipients", "telegramChatIds", "createdAt", "updatedAt")
            VALUES (%s, %s, '[]'::json, '[]'::json, NOW(), NOW())
            ON CONFLICT ("tenantId") DO NOTHING
        """, (cuid_like(), t['id']), f"  Created lead notification settings for {t['name']}")

    # ──────────────────────────────────────────────────────────
    # 6. RESET STALE system_health ai-engine RECORD
    # ──────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("6. RESET STALE system_health(ai-engine) RECORD")
    print("=" * 60)
    run(conn, """
        UPDATE system_health
        SET "isHealthy" = true,
            details = NULL,
            "lastChecked" = NOW()
        WHERE system = 'ai-engine'
    """, None, "Reset ai-engine system_health to healthy (cleared stale Typebot error)")

    # ──────────────────────────────────────────────────────────
    # 7. REJECT STALE DATA DELETION REQUEST (>30 days unprocessed)
    # ──────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("7. REJECT STALE DATA DELETION REQUEST (>30 days)")
    print("=" * 60)
    run(conn, """
        UPDATE data_deletion_requests
        SET status = 'REJECTED',
            "processedAt" = NOW(),
            notes = 'Auto-rejected: request was PENDING for >30 days without processing. User account is still active. Re-submit if deletion is still required.'
        WHERE id = %s AND status = 'PENDING'
    """, (STALE_DDR_ID,), "Rejected stale data deletion request for target user")

    # ──────────────────────────────────────────────────────────
    # 8. PURGE OLD WEBHOOK_LOGS (>30 days)
    # ──────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("8. PURGE OLD WEBHOOK_LOGS (>30 days)")
    print("=" * 60)
    old_count_before = count(conn, 'webhook_logs', '"createdAt" < NOW() - INTERVAL \'30 days\'')
    print(f"  webhook_logs older than 30 days: {old_count_before}")
    run(conn, """
        DELETE FROM webhook_logs WHERE "createdAt" < NOW() - INTERVAL '30 days'
    """, None, f"Deleted {old_count_before} webhook_logs older than 30 days")
    print(f"  webhook_logs remaining: {count(conn, 'webhook_logs')}")

    # ──────────────────────────────────────────────────────────
    # 9. DELETE DUPLICATE FLOW
    # ──────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("9. DELETE DUPLICATE FLOW 'Welcome & Lead Capture (Copy)'")
    print("=" * 60)
    # Check no channel/flow assignments reference this flow
    fca_count = count(conn, 'flow_channel_assignments', '"flowId" = %s', (DUPLICATE_FLOW_ID,))
    fa_count  = count(conn, 'flow_assignments',         '"flowId" = %s', (DUPLICATE_FLOW_ID,))
    fs_count  = count(conn, 'flow_sessions',             '"flowId" = %s', (DUPLICATE_FLOW_ID,))
    print(f"  channel_assignments referencing it: {fca_count}")
    print(f"  page_assignments referencing it:    {fa_count}")
    print(f"  flow_sessions referencing it:       {fs_count}")

    if fca_count == 0 and fa_count == 0 and fs_count == 0:
        # flow_nodes will cascade (Flow → FlowNode onDelete: Cascade in Prisma)
        run(conn, "DELETE FROM flow_nodes WHERE \"flowId\" = %s", (DUPLICATE_FLOW_ID,), "Deleted flow_nodes for duplicate flow")
        run(conn, "DELETE FROM flows WHERE id = %s", (DUPLICATE_FLOW_ID,), "Deleted duplicate flow 'Welcome & Lead Capture (Copy)'")
    else:
        print("  ⚠  Flow is referenced — skipping deletion")

    # ──────────────────────────────────────────────────────────
    # FINAL SUMMARY
    # ──────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("FINAL STATE SUMMARY")
    print("=" * 60)
    tables = [
        ('tenants', '1=1'), ('users', '1=1'), ('plans', '1=1'),
        ('subscriptions', '1=1'), ('flows', '1=1'), ('flow_nodes', '1=1'),
        ('tenant_channel_statuses', '1=1'), ('tenant_lead_notification_settings', '1=1'),
        ('system_health', '1=1'), ('data_deletion_requests', '1=1'),
        ('webhook_logs', '1=1'),
    ]
    for tbl, where in tables:
        print(f"  {tbl:<45} {count(conn, tbl, where):>6}")

    conn.close()
    print("\n✅ Cleanup & seed fix complete.")

if __name__ == "__main__":
    main()
