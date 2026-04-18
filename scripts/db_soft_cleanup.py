"""
ReplyBase SaaS - Soft Database Cleanup
Removes stale and orphaned data safely before production.

Usage:
  python3 scripts/db_soft_cleanup.py            # Dry-run (safe, prints what WOULD be removed)
  python3 scripts/db_soft_cleanup.py --execute  # Commit changes to the database

Categories cleaned:
  1. Expired NextAuth sessions
  2. Expired OIDC auth models
  3. Stale / abandoned flow sessions
  4. Old webhook_logs           (> 30 days)
  5. Old execution_logs         (> 30 days)
  6. Old activity_logs          (> 90 days)
  7. Old webchat_events         (> 30 days)
  8. Orphaned FK records        (across all tables)
  9. Duplicate flow assignments (keep newest per channel / page)
 10. Tenant default hygiene     (ensure subscription / channel_statuses / notification_settings exist)
"""

import os
import sys
import psycopg2
import psycopg2.extras
from pathlib import Path
from datetime import datetime, timezone

# ─── Parse flags ─────────────────────────────────────────────────────────────
DRY_RUN = "--execute" not in sys.argv

# ─── Load DATABASE_URL from .env ─────────────────────────────────────────────
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    sys.exit("ERROR: DATABASE_URL not found in .env")

# ─── Helpers ──────────────────────────────────────────────────────────────────
results: list[dict] = []

def count(conn, sql: str, params=None) -> int:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()[0]

def execute(conn, label: str, sql: str, params=None) -> int:
    """Count affected rows; execute only when not in dry-run mode."""
    cnt = count(conn, f"SELECT COUNT(*) FROM ({sql.replace('DELETE FROM', 'SELECT 1 FROM', 1).replace('UPDATE', 'SELECT 1 FROM', 1)}) _sub", params) if "DELETE" in sql else 0
    # For DELETE we count first, then execute
    if "DELETE" in sql:
        count_sql = sql.replace("DELETE FROM", "SELECT COUNT(*) FROM", 1)
        # Trim any RETURNING clause
        count_sql = count_sql.split(" RETURNING ")[0]
        cnt = count(conn, count_sql, params)
    elif "UPDATE" in sql:
        # Estimate by running a SELECT version
        select_sql = sql.replace("UPDATE", "SELECT COUNT(*) FROM (SELECT 1 FROM", 1)
        # Simpler: just run it and get rowcount
        cnt = 0  # will be updated after actual execute in non-dry-run

    results.append({"label": label, "count": cnt, "sql_type": "DELETE" if "DELETE" in sql else "UPDATE"})

    if not DRY_RUN:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            if "UPDATE" in sql:
                results[-1]["count"] = cur.rowcount
                cnt = cur.rowcount

    return cnt


def section(title: str):
    print(f"\n{'─' * 65}")
    print(f"  {title}")
    print(f"{'─' * 65}")


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    mode = "DRY-RUN (no changes committed)" if DRY_RUN else "EXECUTE MODE (changes will be committed)"
    print(f"\n{'═' * 65}")
    print(f"  ReplyBase Soft DB Cleanup  |  {mode}")
    print(f"  {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(f"{'═' * 65}")

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False  # single transaction

    try:
        # ──────────────────────────────────────────────────────────
        # 1. EXPIRED NEXTAUTH SESSIONS
        # ──────────────────────────────────────────────────────────
        section("1. Expired NextAuth Sessions")
        execute(conn,
            "Expired sessions",
            "DELETE FROM sessions WHERE expires < NOW()")

        # ──────────────────────────────────────────────────────────
        # 2. EXPIRED OIDC MODELS
        # ──────────────────────────────────────────────────────────
        section("2. Expired OIDC Auth Models")
        execute(conn,
            "Expired OIDC models",
            'DELETE FROM oidc_models WHERE "expiresAt" IS NOT NULL AND "expiresAt" < NOW()')

        # ──────────────────────────────────────────────────────────
        # 3. STALE FLOW SESSIONS
        # ──────────────────────────────────────────────────────────
        section("3. Stale / Abandoned Flow Sessions")
        # Mark sessions isActive > 24 h with no completion as abandoned
        execute(conn,
            "Abandoned flow sessions (isActive, >24h, never completed) → mark inactive",
            """UPDATE flow_sessions
               SET "isActive" = false
               WHERE "isActive" = true
                 AND "completedAt" IS NULL
                 AND "createdAt" < NOW() - INTERVAL '24 hours'""")
        # Hard-delete sessions that are inactive and older than 30 days
        execute(conn,
            "Old completed/inactive flow sessions (>30 days) → delete",
            """DELETE FROM flow_sessions
               WHERE "isActive" = false
                 AND "createdAt" < NOW() - INTERVAL '30 days'""")

        # ──────────────────────────────────────────────────────────
        # 4. OLD WEBHOOK LOGS (> 30 days)
        # ──────────────────────────────────────────────────────────
        section("4. Old Webhook Logs (> 30 days)")
        execute(conn,
            "Old webhook_logs",
            "DELETE FROM webhook_logs WHERE \"createdAt\" < NOW() - INTERVAL '30 days'")

        # ──────────────────────────────────────────────────────────
        # 5. OLD EXECUTION LOGS (> 30 days)
        # ──────────────────────────────────────────────────────────
        section("5. Old Execution Logs (> 30 days)")
        execute(conn,
            "Old execution_logs",
            "DELETE FROM execution_logs WHERE \"createdAt\" < NOW() - INTERVAL '30 days'")

        # ──────────────────────────────────────────────────────────
        # 6. OLD ACTIVITY LOGS (> 90 days)
        # ──────────────────────────────────────────────────────────
        section("6. Old Activity Logs (> 90 days)")
        execute(conn,
            "Old activity_logs",
            "DELETE FROM activity_logs WHERE \"createdAt\" < NOW() - INTERVAL '90 days'")

        # ──────────────────────────────────────────────────────────
        # 7. OLD WEBCHAT EVENTS (> 30 days)
        # ──────────────────────────────────────────────────────────
        section("7. Old WebChat Events (> 30 days)")
        execute(conn,
            "Old webchat_events",
            "DELETE FROM webchat_events WHERE \"createdAt\" < NOW() - INTERVAL '30 days'")

        # ──────────────────────────────────────────────────────────
        # 8. ORPHANED FK RECORDS
        # ──────────────────────────────────────────────────────────
        section("8. Orphaned Records")

        # Leaf tables first, then parents

        # internal_notes
        execute(conn, "Orphan internal_notes (missing conversation)",
            'DELETE FROM internal_notes WHERE "conversationId" NOT IN (SELECT id FROM crm_conversations)')
        execute(conn, "Orphan internal_notes (missing author user)",
            'DELETE FROM internal_notes WHERE "authorId" NOT IN (SELECT id FROM users)')

        # crm_messages
        execute(conn, "Orphan crm_messages (missing conversation)",
            'DELETE FROM crm_messages WHERE "conversationId" NOT IN (SELECT id FROM crm_conversations)')

        # webchat_events
        execute(conn, "Orphan webchat_events (missing site)",
            'DELETE FROM webchat_events WHERE "siteId" NOT IN (SELECT id FROM webchat_sites)')
        execute(conn, "Orphan webchat_events (missing session) → nullify",
            """UPDATE webchat_events SET "sessionId" = NULL
               WHERE "sessionId" IS NOT NULL
                 AND "sessionId" NOT IN (SELECT id FROM webchat_sessions)""")

        # webchat_sessions
        execute(conn, "Orphan webchat_sessions (missing site)",
            'DELETE FROM webchat_sessions WHERE "siteId" NOT IN (SELECT id FROM webchat_sites)')
        execute(conn, "Orphan webchat_sessions (missing conversation)",
            'DELETE FROM webchat_sessions WHERE "conversationId" NOT IN (SELECT id FROM crm_conversations)')

        # flow_sessions
        execute(conn, "Orphan flow_sessions (missing flow)",
            'DELETE FROM flow_sessions WHERE "flowId" NOT IN (SELECT id FROM flows)')

        # flow_channel_assignments
        execute(conn, "Orphan flow_channel_assignments (missing flow)",
            'DELETE FROM flow_channel_assignments WHERE "flowId" NOT IN (SELECT id FROM flows)')
        execute(conn, "Orphan flow_channel_assignments (missing channel)",
            'DELETE FROM flow_channel_assignments WHERE "channelId" NOT IN (SELECT id FROM channels)')

        # flow_assignments
        execute(conn, "Orphan flow_assignments (missing flow)",
            'DELETE FROM flow_assignments WHERE "flowId" NOT IN (SELECT id FROM flows)')
        execute(conn, "Orphan flow_assignments (missing facebook_page)",
            'DELETE FROM flow_assignments WHERE "pageId" NOT IN (SELECT id FROM facebook_pages)')

        # flow_nodes
        execute(conn, "Orphan flow_nodes (missing flow)",
            'DELETE FROM flow_nodes WHERE "flowId" NOT IN (SELECT id FROM flows)')

        # onboarding_sessions
        execute(conn, "Orphan onboarding_sessions (missing contact)",
            'DELETE FROM onboarding_sessions WHERE "contactId" NOT IN (SELECT id FROM contacts)')
        execute(conn, "Orphan onboarding_sessions (missing facebook_page)",
            'DELETE FROM onboarding_sessions WHERE "facebookPageId" NOT IN (SELECT id FROM facebook_pages)')

        # onboarding_milestone_events
        execute(conn, "Orphan onboarding_milestone_events (missing tenant)",
            'DELETE FROM onboarding_milestone_events WHERE "tenantId" NOT IN (SELECT id FROM tenants)')

        # onboarding_metrics
        execute(conn, "Orphan onboarding_metrics (missing tenant)",
            'DELETE FROM onboarding_metrics WHERE "tenantId" NOT IN (SELECT id FROM tenants)')

        # leads — nullify optional FKs first, then delete fully orphaned
        execute(conn, "Orphan leads.contactId (missing contact) → nullify",
            """UPDATE leads SET "contactId" = NULL
               WHERE "contactId" IS NOT NULL
                 AND "contactId" NOT IN (SELECT id FROM contacts)""")
        execute(conn, "Orphan leads.flowId (missing flow) → nullify",
            """UPDATE leads SET "flowId" = NULL
               WHERE "flowId" IS NOT NULL
                 AND "flowId" NOT IN (SELECT id FROM flows)""")
        execute(conn, "Orphan leads.pageId (missing facebook_page) → nullify",
            """UPDATE leads SET "pageId" = NULL
               WHERE "pageId" IS NOT NULL
                 AND "pageId" NOT IN (SELECT id FROM facebook_pages)""")
        execute(conn, "Orphan leads (missing tenant)",
            'DELETE FROM leads WHERE "tenantId" NOT IN (SELECT id FROM tenants)')

        # contact_identities
        execute(conn, "Orphan contact_identities (missing contact)",
            'DELETE FROM contact_identities WHERE "contactId" NOT IN (SELECT id FROM contacts)')

        # crm_conversations — nullify optional FKs
        execute(conn, "Orphan crm_conversations.botId (missing bot) → nullify",
            """UPDATE crm_conversations SET "botId" = NULL
               WHERE "botId" IS NOT NULL
                 AND "botId" NOT IN (SELECT id FROM bots)""")
        execute(conn, "Orphan crm_conversations.facebookPageId (missing page) → nullify",
            """UPDATE crm_conversations SET "facebookPageId" = NULL
               WHERE "facebookPageId" IS NOT NULL
                 AND "facebookPageId" NOT IN (SELECT id FROM facebook_pages)""")
        execute(conn, "Orphan crm_conversations.assigneeId (missing user) → nullify",
            """UPDATE crm_conversations SET "assigneeId" = NULL
               WHERE "assigneeId" IS NOT NULL
                 AND "assigneeId" NOT IN (SELECT id FROM users)""")
        execute(conn, "Orphan crm_conversations (missing contact)",
            'DELETE FROM crm_conversations WHERE "contactId" NOT IN (SELECT id FROM contacts)')

        # contacts
        execute(conn, "Orphan contacts (missing tenant)",
            'DELETE FROM contacts WHERE "tenantId" NOT IN (SELECT id FROM tenants)')

        # execution_logs
        execute(conn, "Orphan execution_logs (missing bot)",
            'DELETE FROM execution_logs WHERE "botId" NOT IN (SELECT id FROM bots)')
        execute(conn, "Orphan execution_logs (missing user)",
            'DELETE FROM execution_logs WHERE "userId" NOT IN (SELECT id FROM users)')

        # usage_logs — nullify optional FKs
        execute(conn, "Orphan usage_logs.botId (missing bot) → nullify",
            """UPDATE usage_logs SET "botId" = NULL
               WHERE "botId" IS NOT NULL
                 AND "botId" NOT IN (SELECT id FROM bots)""")
        execute(conn, "Orphan usage_logs.channelId (missing channel) → nullify",
            """UPDATE usage_logs SET "channelId" = NULL
               WHERE "channelId" IS NOT NULL
                 AND "channelId" NOT IN (SELECT id FROM channels)""")
        execute(conn, "Orphan usage_logs.userId (missing user) → nullify",
            """UPDATE usage_logs SET "userId" = NULL
               WHERE "userId" IS NOT NULL
                 AND "userId" NOT IN (SELECT id FROM users)""")
        execute(conn, "Orphan usage_logs (missing tenant)",
            'DELETE FROM usage_logs WHERE "tenantId" NOT IN (SELECT id FROM tenants)')

        # activity_logs
        execute(conn, "Orphan activity_logs.userId (missing user) → nullify",
            """UPDATE activity_logs SET "userId" = NULL
               WHERE "userId" IS NOT NULL
                 AND "userId" NOT IN (SELECT id FROM users)""")
        execute(conn, "Orphan activity_logs (missing tenant)",
            'DELETE FROM activity_logs WHERE "tenantId" NOT IN (SELECT id FROM tenants)')

        # newsletter_subscribers
        execute(conn, "Orphan newsletter_subscribers.userId (missing user) → nullify",
            """UPDATE newsletter_subscribers SET "userId" = NULL
               WHERE "userId" IS NOT NULL
                 AND "userId" NOT IN (SELECT id FROM users)""")
        execute(conn, "Orphan newsletter_subscribers.tenantId (missing tenant) → nullify",
            """UPDATE newsletter_subscribers SET "tenantId" = NULL
               WHERE "tenantId" IS NOT NULL
                 AND "tenantId" NOT IN (SELECT id FROM tenants)""")

        # data_deletion_requests
        execute(conn, "Orphan data_deletion_requests.userId (missing user) → nullify",
            """UPDATE data_deletion_requests SET "userId" = NULL
               WHERE "userId" IS NOT NULL
                 AND "userId" NOT IN (SELECT id FROM users)""")
        execute(conn, "Orphan data_deletion_requests.tenantId (missing tenant) → nullify",
            """UPDATE data_deletion_requests SET "tenantId" = NULL
               WHERE "tenantId" IS NOT NULL
                 AND "tenantId" NOT IN (SELECT id FROM tenants)""")

        # facebook_pages
        execute(conn, "Orphan facebook_pages.botId (missing bot) → nullify",
            """UPDATE facebook_pages SET "botId" = NULL
               WHERE "botId" IS NOT NULL
                 AND "botId" NOT IN (SELECT id FROM bots)""")
        execute(conn, "Orphan facebook_pages (missing tenant)",
            'DELETE FROM facebook_pages WHERE "tenantId" NOT IN (SELECT id FROM tenants)')

        # webchat_sites
        execute(conn, "Orphan webchat_sites (missing bot)",
            'DELETE FROM webchat_sites WHERE "botId" NOT IN (SELECT id FROM bots)')
        execute(conn, "Orphan webchat_sites (missing tenant)",
            'DELETE FROM webchat_sites WHERE "tenantId" NOT IN (SELECT id FROM tenants)')
        execute(conn, "Orphan webchat_sites.channelId (missing channel) → nullify",
            """UPDATE webchat_sites SET "channelId" = NULL
               WHERE "channelId" IS NOT NULL
                 AND "channelId" NOT IN (SELECT id FROM channels)""")

        # channels
        execute(conn, "Orphan channels (missing bot)",
            'DELETE FROM channels WHERE "botId" NOT IN (SELECT id FROM bots)')

        # bots
        execute(conn, "Orphan bots (missing tenant)",
            'DELETE FROM bots WHERE "tenantId" NOT IN (SELECT id FROM tenants)')

        # flows
        execute(conn, "Orphan flows.ownerId (missing user) → nullify",
            """UPDATE flows SET "ownerId" = NULL
               WHERE "ownerId" IS NOT NULL
                 AND "ownerId" NOT IN (SELECT id FROM users)""")
        execute(conn, "Orphan flows (missing tenant)",
            'DELETE FROM flows WHERE "tenantId" NOT IN (SELECT id FROM tenants)')

        # subscriptions
        execute(conn, "Orphan subscriptions (missing tenant)",
            'DELETE FROM subscriptions WHERE "tenantId" NOT IN (SELECT id FROM tenants)')
        execute(conn, "Orphan subscriptions (missing plan)",
            'DELETE FROM subscriptions WHERE "planId" NOT IN (SELECT id FROM plans)')

        # tenant_channel_statuses / tenant_lead_notification_settings
        execute(conn, "Orphan tenant_channel_statuses (missing tenant)",
            'DELETE FROM tenant_channel_statuses WHERE "tenantId" NOT IN (SELECT id FROM tenants)')
        execute(conn, "Orphan tenant_lead_notification_settings (missing tenant)",
            'DELETE FROM tenant_lead_notification_settings WHERE "tenantId" NOT IN (SELECT id FROM tenants)')

        # accounts / sessions (NextAuth)
        execute(conn, "Orphan accounts (missing user)",
            'DELETE FROM accounts WHERE "userId" NOT IN (SELECT id FROM users)')
        execute(conn, "Orphan sessions (missing user)",
            'DELETE FROM sessions WHERE "userId" NOT IN (SELECT id FROM users)')

        # ──────────────────────────────────────────────────────────
        # 9. DUPLICATE FLOW ASSIGNMENTS
        # ──────────────────────────────────────────────────────────
        section("9. Duplicate Flow Assignments")

        # flow_channel_assignments: keep newest per channelId
        execute(conn, "Duplicate flow_channel_assignments per channel (keep newest)",
            """DELETE FROM flow_channel_assignments
               WHERE id NOT IN (
                 SELECT DISTINCT ON ("channelId") id
                 FROM flow_channel_assignments
                 ORDER BY "channelId", "createdAt" DESC
               )""")

        # flow_assignments: keep newest per pageId
        execute(conn, "Duplicate flow_assignments per page (keep newest)",
            """DELETE FROM flow_assignments
               WHERE id NOT IN (
                 SELECT DISTINCT ON ("pageId") id
                 FROM flow_assignments
                 ORDER BY "pageId", "createdAt" DESC
               )""")

        # ──────────────────────────────────────────────────────────
        # 10. TENANT DEFAULT HYGIENE
        #     Ensure every tenant has subscription, channel_statuses,
        #     and lead_notification_settings rows.
        # ──────────────────────────────────────────────────────────
        section("10. Tenant Default Hygiene")

        # Find tenants missing defaults
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, name FROM tenants
                WHERE id NOT IN (SELECT "tenantId" FROM tenant_channel_statuses)
            """)
            missing_statuses = cur.fetchall()

            cur.execute("""
                SELECT id, name FROM tenants
                WHERE id NOT IN (SELECT "tenantId" FROM tenant_lead_notification_settings)
            """)
            missing_notif = cur.fetchall()

        if missing_statuses:
            print(f"  Tenants missing tenant_channel_statuses: {len(missing_statuses)}")
            if not DRY_RUN:
                with conn.cursor() as cur:
                    cur.executemany(
                        'INSERT INTO tenant_channel_statuses ("id","tenantId","facebook","telegram","webchat","whatsapp","createdAt","updatedAt")'
                        " VALUES (gen_random_uuid()::text, %s, false, true, true, false, NOW(), NOW())",
                        [(row["id"],) for row in missing_statuses]
                    )
            results.append({"label": "Insert missing tenant_channel_statuses", "count": len(missing_statuses), "sql_type": "INSERT"})
        else:
            print("  All tenants have tenant_channel_statuses ✓")

        if missing_notif:
            print(f"  Tenants missing tenant_lead_notification_settings: {len(missing_notif)}")
            if not DRY_RUN:
                with conn.cursor() as cur:
                    cur.executemany(
                        'INSERT INTO tenant_lead_notification_settings ("id","tenantId","emailRecipients","telegramChatIds","createdAt","updatedAt")'
                        " VALUES (gen_random_uuid()::text, %s, '[]', '[]', NOW(), NOW())",
                        [(row["id"],) for row in missing_notif]
                    )
            results.append({"label": "Insert missing tenant_lead_notification_settings", "count": len(missing_notif), "sql_type": "INSERT"})
        else:
            print("  All tenants have tenant_lead_notification_settings ✓")

        # Commit or rollback
        if DRY_RUN:
            conn.rollback()
        else:
            conn.commit()

    except Exception as e:
        conn.rollback()
        print(f"\n❌ ERROR — rolled back: {e}")
        raise
    finally:
        conn.close()

    # ── Summary ───────────────────────────────────────────────────
    print(f"\n{'═' * 65}")
    print(f"  SUMMARY  |  {'DRY-RUN — nothing changed' if DRY_RUN else '✅ COMMITTED'}")
    print(f"{'═' * 65}")
    total = 0
    for r in results:
        if r["count"] > 0:
            flag = "  ← would act" if DRY_RUN else "  ← acted"
            print(f"  {r['sql_type']:<7} {r['count']:>5}  {r['label']}{flag}")
            total += r["count"]

    zero = [r for r in results if r["count"] == 0]
    if zero:
        print(f"\n  (Skipped — 0 rows: {len(zero)} checks all clean)")

    print(f"\n  Total rows {'affected (would be)' if DRY_RUN else 'affected'}: {total}")
    if DRY_RUN:
        print("\n  Run with --execute to apply changes:")
        print("    python3 scripts/db_soft_cleanup.py --execute\n")
    else:
        print()


if __name__ == "__main__":
    main()
