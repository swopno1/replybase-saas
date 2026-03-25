#!/usr/bin/env python3
"""Deep-dive investigation on specific DB issues found in audit."""

import psycopg2, psycopg2.extras, json

DB_URL = "postgres://postgres:2b1HcgrA4TZHQ7L8MPsCwUAM9QbFafetMu0agPoAk4onrILLZb1kKjVeVyKaAHFL@104.248.160.102:5432/replybase_saas"

def q(conn, sql, label=""):
    print(f"\n--- {label} ---")
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        try:
            cur.execute(sql)
            rows = cur.fetchall()
            for r in rows:
                print("  ", dict(r))
            if not rows:
                print("  (empty)")
        except Exception as e:
            print(f"  ERROR: {e}")
            conn.rollback()
    return rows if 'rows' in dir() else []

conn = psycopg2.connect(DB_URL)
conn.autocommit = True

# 1. Tenants overview
q(conn, "SELECT id, name, \"aiEnabled\", \"createdAt\" FROM tenants ORDER BY \"createdAt\"", "All Tenants")

# 2. Subscriptions overview
q(conn, """SELECT s.id, s."tenantId", t.name AS tenant_name, s.status, s."planId", p.name AS plan_name, s."trialEndsAt", s."currentPeriodEnd"
           FROM subscriptions s
           JOIN tenants t ON t.id = s."tenantId"
           JOIN plans p ON p.id = s."planId"
           ORDER BY t.name""", "All Subscriptions")

# 3. Free plan details  
q(conn, "SELECT * FROM plans", "All Plans (full)")

# 4. Users overview
q(conn, """SELECT u.id, u.email, u."isAdmin", u."tenantId", t.name AS tenant, u."createdAt"
           FROM users u JOIN tenants t ON t.id = u."tenantId"
           ORDER BY u."createdAt\"""", "All Users")

# 5. Flows overview
q(conn, """SELECT f.id, f.name, f."tenantId", t.name AS tenant_name, f."isGlobal", f."isActive",
           (SELECT count(*) FROM flow_nodes fn WHERE fn."flowId" = f.id) AS node_count
           FROM flows f
           LEFT JOIN tenants t ON t.id = f."tenantId"
           ORDER BY f."createdAt\"""", "All Flows")

# 6. Check if seed-flows.sql hardcoded node flow IDs actually exist
hardcoded_flow_ids = [
    '1ade0648-7491-4732-a7f6-b4193133466d',
    '40435cc3-c71f-404f-8271-6835ea79d3ca',
    'f62dbc60-f55e-4b94-9353-8a5c697a868f',
    'b67edf16-50a4-4d92-a76c-ab9106bdee7f',
    'd7919435-f5b1-4956-b9c5-f5b5e0de2e10',
]
for fid in hardcoded_flow_ids:
    q(conn, f"SELECT count(*) AS node_count FROM flow_nodes WHERE \"flowId\" = '{fid}'", f"flow_nodes for hardcoded ID {fid}")

# 7. Flow nodes by flow
q(conn, """SELECT fn."flowId", f.name AS flow_name, count(*) AS nodes
           FROM flow_nodes fn
           LEFT JOIN flows f ON f.id = fn."flowId"
           GROUP BY fn."flowId", f.name
           ORDER BY fn."flowId\"""", "Flow nodes grouped by flow")

# 8. Data deletion requests
q(conn, "SELECT * FROM data_deletion_requests", "Data deletion requests")

# 9. Tenant channel statuses (only 1 for 6 tenants)
q(conn, """SELECT t.id, t.name, tcs.id AS status_id, tcs.facebook, tcs.telegram, tcs.webchat
           FROM tenants t
           LEFT JOIN tenant_channel_statuses tcs ON tcs."tenantId" = t.id
           ORDER BY t.name""", "Tenants vs channel statuses")

# 10. Tenant lead notification settings  
q(conn, """SELECT t.id, t.name, tln.id AS settings_id
           FROM tenants t
           LEFT JOIN tenant_lead_notification_settings tln ON tln."tenantId" = t.id
           ORDER BY t.name""", "Tenants vs lead notification settings")

# 11. System health
q(conn, "SELECT system, \"isHealthy\", details FROM system_health", "System health details")

# 12. Bots
q(conn, """SELECT b.id, b.name, b."tenantId", t.name AS tenant,
           (SELECT count(*) FROM channels c WHERE c."botId" = b.id) AS channel_count
           FROM bots b JOIN tenants t ON t.id = b."tenantId\"""", "Bots")

# 13. Channels
q(conn, """SELECT c.id, c.type, c.name, c."isActive", c."killSwitch", c."botId",
           b.name AS bot_name
           FROM channels c JOIN bots b ON b.id = c."botId\"""", "Channels")

# 14. Webhook logs - old ones
q(conn, """SELECT source, type, count(*) AS cnt, min("createdAt") AS oldest, max("createdAt") AS newest
           FROM webhook_logs GROUP BY source, type ORDER BY source, type""", "Webhook logs summary")

# 15. Subscriptions with free plan - check currency
q(conn, "SELECT id, name, price, currency, \"dailyMessageLimit\", \"monthlyMessageLimit\", \"maxBots\", \"maxFlows\" FROM plans", "Plans detail")

conn.close()
print("\nDeep-dive complete.")
