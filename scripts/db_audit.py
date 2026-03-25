#!/usr/bin/env python3
"""
ReplyBase SaaS - Database Audit Script
Checks for orphan records, ambiguous data, and seed issues.
"""

import os
import sys

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("Installing psycopg2...")
    os.system(f"{sys.executable} -m pip install psycopg2-binary -q")
    import psycopg2
    import psycopg2.extras

DB_URL = "postgres://postgres:2b1HcgrA4TZHQ7L8MPsCwUAM9QbFafetMu0agPoAk4onrILLZb1kKjVeVyKaAHFL@104.248.160.102:5432/replybase_saas"

def run(conn, sql, label=None):
    if label:
        print(f"\n{'='*60}")
        print(f"  {label}")
        print('='*60)
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        try:
            cur.execute(sql)
            rows = cur.fetchall()
            if rows:
                # Print column headers
                headers = list(rows[0].keys())
                print("  " + " | ".join(f"{h:<30}" for h in headers))
                print("  " + "-" * (32 * len(headers)))
                for row in rows:
                    print("  " + " | ".join(f"{str(row[h]):<30}" for h in headers))
            else:
                print("  (no rows - CLEAN)")
            return rows
        except Exception as e:
            print(f"  ERROR: {e}")
            conn.rollback()
            return []

def main():
    print("Connecting to ReplyBase SaaS database...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    print("Connected!\n")

    # ─────────────────────────────────────────────────────────────
    # 1. ROW COUNTS
    # ─────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("  ROW COUNTS PER TABLE")
    print("="*60)
    tables = [
        "users", "tenants", "bots", "channels", "plans", "subscriptions",
        "flows", "flow_nodes", "flow_assignments", "flow_channel_assignments",
        "flow_sessions", "facebook_pages", "contacts", "contact_identities",
        "crm_conversations", "crm_messages", "leads", "webchat_sites",
        "webchat_sessions", "webchat_events", "execution_logs", "usage_logs",
        "activity_logs", "internal_notes", "accounts", "sessions",
        "webhook_logs", "system_health", "oidc_models",
        "newsletter_subscribers", "data_deletion_requests",
        "onboarding_sessions", "demo_templates", "onboarding_metrics",
        "onboarding_milestone_events", "tenant_channel_statuses",
        "tenant_lead_notification_settings",
    ]
    with conn.cursor() as cur:
        for tbl in tables:
            try:
                cur.execute(f'SELECT count(*) FROM "{tbl}"')
                cnt = cur.fetchone()[0]
                print(f"  {tbl:<45} {cnt:>6}")
            except Exception as e:
                print(f"  {tbl:<45} ERROR: {e}")
                conn.rollback()

    # ─────────────────────────────────────────────────────────────
    # 2. ORPHAN CHECKS
    # ─────────────────────────────────────────────────────────────

    run(conn, 'SELECT id, email, "tenantId" FROM users WHERE "tenantId" NOT IN (SELECT id FROM tenants)',
        "ORPHAN: users with missing tenant")

    run(conn, 'SELECT id, name, "tenantId" FROM bots WHERE "tenantId" NOT IN (SELECT id FROM tenants)',
        "ORPHAN: bots with missing tenant")

    run(conn, 'SELECT id, type, "botId" FROM channels WHERE "botId" NOT IN (SELECT id FROM bots)',
        "ORPHAN: channels with missing bot")

    run(conn, 'SELECT id, "tenantId" FROM subscriptions WHERE "tenantId" NOT IN (SELECT id FROM tenants)',
        "ORPHAN: subscriptions with missing tenant")

    run(conn, 'SELECT id, "planId" FROM subscriptions WHERE "planId" NOT IN (SELECT id FROM plans)',
        "ORPHAN: subscriptions with missing plan")

    run(conn, 'SELECT id, name, "tenantId" FROM flows WHERE "tenantId" NOT IN (SELECT id FROM tenants)',
        "ORPHAN: flows with missing tenant")

    run(conn, 'SELECT id, "flowId" FROM flow_nodes WHERE "flowId" NOT IN (SELECT id FROM flows)',
        "ORPHAN: flow_nodes with missing flow")

    run(conn, 'SELECT id, "flowId" FROM flow_assignments WHERE "flowId" NOT IN (SELECT id FROM flows)',
        "ORPHAN: flow_assignments with missing flow")

    run(conn, 'SELECT id, "pageId" FROM flow_assignments WHERE "pageId" NOT IN (SELECT id FROM facebook_pages)',
        "ORPHAN: flow_assignments with missing facebook_page")

    run(conn, 'SELECT id, "flowId" FROM flow_channel_assignments WHERE "flowId" NOT IN (SELECT id FROM flows)',
        "ORPHAN: flow_channel_assignments with missing flow")

    run(conn, 'SELECT id, "channelId" FROM flow_channel_assignments WHERE "channelId" NOT IN (SELECT id FROM channels)',
        "ORPHAN: flow_channel_assignments with missing channel")

    run(conn, 'SELECT id, "flowId" FROM flow_sessions WHERE "flowId" NOT IN (SELECT id FROM flows)',
        "ORPHAN: flow_sessions with missing flow")

    run(conn, 'SELECT id, name, "tenantId" FROM facebook_pages WHERE "tenantId" NOT IN (SELECT id FROM tenants)',
        "ORPHAN: facebook_pages with missing tenant")

    run(conn, 'SELECT id, name, "botId" FROM facebook_pages WHERE "botId" IS NOT NULL AND "botId" NOT IN (SELECT id FROM bots)',
        "ORPHAN: facebook_pages pointing to missing bot")

    run(conn, 'SELECT id, "tenantId" FROM contacts WHERE "tenantId" NOT IN (SELECT id FROM tenants)',
        "ORPHAN: contacts with missing tenant")

    run(conn, 'SELECT id, "contactId" FROM contact_identities WHERE "contactId" NOT IN (SELECT id FROM contacts)',
        "ORPHAN: contact_identities with missing contact")

    run(conn, 'SELECT id, "contactId" FROM crm_conversations WHERE "contactId" NOT IN (SELECT id FROM contacts)',
        "ORPHAN: crm_conversations with missing contact")

    run(conn, 'SELECT id, "botId" FROM crm_conversations WHERE "botId" IS NOT NULL AND "botId" NOT IN (SELECT id FROM bots)',
        "ORPHAN: crm_conversations pointing to missing bot")

    run(conn, 'SELECT id, "facebookPageId" FROM crm_conversations WHERE "facebookPageId" IS NOT NULL AND "facebookPageId" NOT IN (SELECT id FROM facebook_pages)',
        "ORPHAN: crm_conversations pointing to missing facebook_page")

    run(conn, 'SELECT id, "assigneeId" FROM crm_conversations WHERE "assigneeId" IS NOT NULL AND "assigneeId" NOT IN (SELECT id FROM users)',
        "ORPHAN: crm_conversations with missing assignee")

    run(conn, 'SELECT id, "conversationId" FROM crm_messages WHERE "conversationId" NOT IN (SELECT id FROM crm_conversations)',
        "ORPHAN: crm_messages with missing conversation")

    run(conn, 'SELECT id, "tenantId" FROM leads WHERE "tenantId" NOT IN (SELECT id FROM tenants)',
        "ORPHAN: leads with missing tenant")

    run(conn, 'SELECT id, "contactId" FROM leads WHERE "contactId" IS NOT NULL AND "contactId" NOT IN (SELECT id FROM contacts)',
        "ORPHAN: leads pointing to missing contact")

    run(conn, 'SELECT id, "flowId" FROM leads WHERE "flowId" IS NOT NULL AND "flowId" NOT IN (SELECT id FROM flows)',
        "ORPHAN: leads pointing to missing flow")

    run(conn, 'SELECT id, "pageId" FROM leads WHERE "pageId" IS NOT NULL AND "pageId" NOT IN (SELECT id FROM facebook_pages)',
        "ORPHAN: leads pointing to missing facebook_page")

    run(conn, 'SELECT id, "botId" FROM webchat_sites WHERE "botId" NOT IN (SELECT id FROM bots)',
        "ORPHAN: webchat_sites with missing bot")

    run(conn, 'SELECT id, "tenantId" FROM webchat_sites WHERE "tenantId" NOT IN (SELECT id FROM tenants)',
        "ORPHAN: webchat_sites with missing tenant")

    run(conn, 'SELECT id, "channelId" FROM webchat_sites WHERE "channelId" IS NOT NULL AND "channelId" NOT IN (SELECT id FROM channels)',
        "ORPHAN: webchat_sites pointing to missing channel")

    run(conn, 'SELECT id, "siteId" FROM webchat_sessions WHERE "siteId" NOT IN (SELECT id FROM webchat_sites)',
        "ORPHAN: webchat_sessions with missing site")

    run(conn, 'SELECT id, "conversationId" FROM webchat_sessions WHERE "conversationId" NOT IN (SELECT id FROM crm_conversations)',
        "ORPHAN: webchat_sessions with missing conversation")

    run(conn, 'SELECT id, "siteId" FROM webchat_events WHERE "siteId" NOT IN (SELECT id FROM webchat_sites)',
        "ORPHAN: webchat_events with missing site")

    run(conn, 'SELECT id, "sessionId" FROM webchat_events WHERE "sessionId" IS NOT NULL AND "sessionId" NOT IN (SELECT id FROM webchat_sessions)',
        "ORPHAN: webchat_events pointing to missing session")

    run(conn, 'SELECT id, "botId" FROM execution_logs WHERE "botId" NOT IN (SELECT id FROM bots)',
        "ORPHAN: execution_logs with missing bot")

    run(conn, 'SELECT id, "userId" FROM execution_logs WHERE "userId" NOT IN (SELECT id FROM users)',
        "ORPHAN: execution_logs with missing user")

    run(conn, 'SELECT id, "tenantId" FROM usage_logs WHERE "tenantId" NOT IN (SELECT id FROM tenants)',
        "ORPHAN: usage_logs with missing tenant")

    run(conn, 'SELECT id, "botId" FROM usage_logs WHERE "botId" IS NOT NULL AND "botId" NOT IN (SELECT id FROM bots)',
        "ORPHAN: usage_logs pointing to missing bot")

    run(conn, 'SELECT id, "userId" FROM usage_logs WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM users)',
        "ORPHAN: usage_logs pointing to missing user")

    run(conn, 'SELECT id, "conversationId" FROM internal_notes WHERE "conversationId" NOT IN (SELECT id FROM crm_conversations)',
        "ORPHAN: internal_notes with missing conversation")

    run(conn, 'SELECT id, "authorId" FROM internal_notes WHERE "authorId" NOT IN (SELECT id FROM users)',
        "ORPHAN: internal_notes with missing author")

    run(conn, 'SELECT id, "userId" FROM accounts WHERE "userId" NOT IN (SELECT id FROM users)',
        "ORPHAN: accounts (NextAuth) with missing user")

    run(conn, 'SELECT id, "userId" FROM sessions WHERE "userId" NOT IN (SELECT id FROM users)',
        "ORPHAN: sessions (NextAuth) with missing user")

    run(conn, 'SELECT id, "tenantId" FROM activity_logs WHERE "tenantId" NOT IN (SELECT id FROM tenants)',
        "ORPHAN: activity_logs with missing tenant")

    run(conn, 'SELECT id, "userId" FROM activity_logs WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM users)',
        "ORPHAN: activity_logs with missing user")

    run(conn, 'SELECT id, "contactId" FROM onboarding_sessions WHERE "contactId" NOT IN (SELECT id FROM contacts)',
        "ORPHAN: onboarding_sessions with missing contact")

    run(conn, 'SELECT id, "facebookPageId" FROM onboarding_sessions WHERE "facebookPageId" NOT IN (SELECT id FROM facebook_pages)',
        "ORPHAN: onboarding_sessions with missing facebook_page")

    run(conn, 'SELECT id, "tenantId" FROM tenant_channel_statuses WHERE "tenantId" NOT IN (SELECT id FROM tenants)',
        "ORPHAN: tenant_channel_statuses with missing tenant")

    run(conn, 'SELECT id, "tenantId" FROM tenant_lead_notification_settings WHERE "tenantId" NOT IN (SELECT id FROM tenants)',
        "ORPHAN: tenant_lead_notification_settings with missing tenant")

    run(conn, 'SELECT id, "tenantId" FROM onboarding_milestone_events WHERE "tenantId" NOT IN (SELECT id FROM tenants)',
        "ORPHAN: onboarding_milestone_events with missing tenant")

    run(conn, 'SELECT id, "userId" FROM newsletter_subscribers WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM users)',
        "ORPHAN: newsletter_subscribers pointing to missing user")

    run(conn, 'SELECT id, "tenantId" FROM newsletter_subscribers WHERE "tenantId" IS NOT NULL AND "tenantId" NOT IN (SELECT id FROM tenants)',
        "ORPHAN: newsletter_subscribers pointing to missing tenant")

    run(conn, 'SELECT id, "userId" FROM data_deletion_requests WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM users)',
        "ORPHAN: data_deletion_requests pointing to missing user")

    run(conn, 'SELECT id, "tenantId" FROM data_deletion_requests WHERE "tenantId" IS NOT NULL AND "tenantId" NOT IN (SELECT id FROM tenants)',
        "ORPHAN: data_deletion_requests pointing to missing tenant")

    # ─────────────────────────────────────────────────────────────
    # 3. AMBIGUITY CHECKS
    # ─────────────────────────────────────────────────────────────

    run(conn, 'SELECT id, name FROM tenants WHERE id NOT IN (SELECT DISTINCT "tenantId" FROM users)',
        "AMBIGUITY: tenants with no users")

    run(conn, 'SELECT id, name FROM tenants WHERE id NOT IN (SELECT "tenantId" FROM subscriptions)',
        "AMBIGUITY: tenants with NO subscription (unsubscribed tenants)")

    run(conn, 'SELECT b.id, b.name, b."tenantId" FROM bots b WHERE b.id NOT IN (SELECT "botId" FROM channels)',
        "AMBIGUITY: bots with no channels")

    run(conn, 'SELECT id, name, "tenantId" FROM flows WHERE id NOT IN (SELECT DISTINCT "flowId" FROM flow_nodes)',
        "AMBIGUITY: flows with no nodes (empty flows)")

    run(conn, """SELECT id, "flowId", "userId", "pageId", "createdAt"
                 FROM flow_sessions
                 WHERE "isActive" = true AND "completedAt" IS NULL
                 AND "createdAt" < NOW() - INTERVAL '24 hours'""",
        "AMBIGUITY: stale flow_sessions (isActive but >24h old, never completed)")

    run(conn, "SELECT id, \"userId\", expires FROM sessions WHERE expires < NOW()",
        "AMBIGUITY: expired NextAuth sessions (should be purged)")

    run(conn, "SELECT id, type, \"expiresAt\" FROM oidc_models WHERE \"expiresAt\" IS NOT NULL AND \"expiresAt\" < NOW()",
        "AMBIGUITY: expired OIDC models")

    run(conn, 'SELECT "channelId", count(*) FROM flow_channel_assignments GROUP BY "channelId" HAVING count(*) > 1',
        "AMBIGUITY: duplicate flow_channel_assignments per channel")

    run(conn, 'SELECT "pageId", count(*) FROM flow_assignments GROUP BY "pageId" HAVING count(*) > 1',
        "AMBIGUITY: duplicate flow_assignments per page")

    run(conn, 'SELECT "tenantId", email, count(*) FROM contacts WHERE email IS NOT NULL GROUP BY "tenantId", email HAVING count(*) > 1',
        "AMBIGUITY: duplicate contact emails per tenant")

    run(conn, 'SELECT "tenantId", phone, count(*) FROM contacts WHERE phone IS NOT NULL GROUP BY "tenantId", phone HAVING count(*) > 1',
        "AMBIGUITY: duplicate contact phones per tenant")

    # ─────────────────────────────────────────────────────────────
    # 4. SEED DATA CHECKS
    # ─────────────────────────────────────────────────────────────

    run(conn, 'SELECT id, name, "displayName", price, currency, "maxBots", "maxFlows" FROM plans ORDER BY price',
        "SEED: Plans (expected: free, starter, pro, business)")

    run(conn, 'SELECT id, name, "displayName", "businessType", enabled, "order" FROM demo_templates ORDER BY "order"',
        "SEED: Demo Templates")

    run(conn, '''SELECT id, name, "createdAt"
                 FROM tenants
                 ORDER BY "createdAt" ASC
                 LIMIT 1''',
        "SEED: tenant selected by seed-flows.sql (oldest tenant)")

    run(conn, """SELECT f.id, f.name, f."tenantId", t.name AS tenant_name, f."isActive"
                 FROM flows f
                 LEFT JOIN tenants t ON t.id = f."tenantId"
                 WHERE f."isGlobal" = true""",
        "SEED: Global flows and their tenant")

    run(conn, 'SELECT * FROM system_health',
        "SEED: System health records")

    # Plans missing maxFlows (from seed-flows.sql references 'standard', 'premium' which don't exist)
    run(conn, "SELECT name FROM plans WHERE name NOT IN ('free','starter','pro','business')",
        "SEED: Unexpected plan names (standard/premium should not exist)")

    run(conn, "SELECT name FROM plans WHERE name IN ('free','starter','pro','business')",
        "SEED: Expected plan names present")

    # ─────────────────────────────────────────────────────────────
    # 5. LEGACY TYPEBOT TABLE SIZES
    # ─────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("  LEGACY TYPEBOT TABLE SIZES")
    print("="*60)
    legacy_tables = [
        "Typebot", "Workspace", "Result", "Answer", "AnswerV2",
        "Log", "User", "Account", "Session", "ChatSession",
        "PublicTypebot", "MemberInWorkspace", "CollaboratorsOnTypebots",
        "DashboardFolder", "BannedIp", "ApiToken",
    ]
    with conn.cursor() as cur:
        for tbl in legacy_tables:
            try:
                cur.execute(f'SELECT count(*) FROM "{tbl}"')
                cnt = cur.fetchone()[0]
                flag = "  ⚠ HAS DATA" if cnt > 0 else ""
                print(f"  {tbl:<45} {cnt:>6}{flag}")
            except Exception as e:
                print(f"  {tbl:<45} ERROR: {e}")
                conn.rollback()

    conn.close()
    print("\n\nAudit complete.")

if __name__ == "__main__":
    main()
