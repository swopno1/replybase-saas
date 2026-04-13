-- ═══════════════════════════════════════════════════════════════════════════
-- Facebook Integration Diagnostic Queries
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Purpose: Diagnose why "Get Started" trigger did not execute flow
-- Required psql vars:
--   TEST_EMAIL
-- Optional psql vars:
--   PAGE_NAME (defaults to %Dreamer%)
-- 
-- Usage:
--   psql "$DATABASE_URL" -v TEST_EMAIL="'''user@example.com'''" -f scripts/diagnose-facebook-integration.sql
-- ═══════════════════════════════════════════════════════════════════════════

\if :{?TEST_EMAIL}
\else
\echo 'TEST_EMAIL psql variable is required, e.g. -v TEST_EMAIL="'''\''user@example.com\'''''"'
\quit 1
\endif

\if :{?PAGE_NAME}
\else
\set PAGE_NAME '''%Dreamer%'''
\endif

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 1: AUTHENTICATION VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

\echo '\n🔎 PHASE 1 — AUTHENTICATION VERIFICATION\n'

-- Query 1.1: Find User and Tenant
\echo '📊 Query 1.1: User and Tenant Information'
SELECT 
  u.id as user_id,
  u.name as user_name,
  u.email,
  u."tenantId",
  t.name as tenant_name,
  t."aiEnabled" as tenant_ai_enabled,
  u."createdAt" as user_created_at
FROM users u
LEFT JOIN tenants t ON u."tenantId" = t.id
WHERE u.email = :TEST_EMAIL;

-- Query 1.2: Facebook OAuth Record
\echo '\n📊 Query 1.2: Facebook OAuth Connection'
SELECT 
  a.id as account_id,
  a.provider,
  a."providerAccountId" as fb_user_id,
  LENGTH(a.access_token) as token_length,
  a.expires_at,
  CASE 
    WHEN a.expires_at IS NULL THEN 'No expiry set'
    WHEN a.expires_at * 1000 < EXTRACT(EPOCH FROM NOW()) * 1000 THEN '⚠️ EXPIRED'
    ELSE '✅ Valid'
  END as token_status,
  a.scope as granted_scopes,
  a."createdAt" as connected_at
FROM accounts a
WHERE a."userId" = (SELECT id FROM users WHERE email = :TEST_EMAIL)
  AND a.provider = 'facebook';

-- Query 1.3: Required Scopes Validation
\echo '\n📊 Query 1.3: Required Scopes Check'
SELECT 
  a.scope,
  a.scope LIKE '%pages_manage_metadata%' as has_pages_manage_metadata,
  a.scope LIKE '%pages_manage_engagement%' as has_pages_manage_engagement,
  a.scope LIKE '%pages_read_engagement%' as has_pages_read_engagement,
  a.scope LIKE '%pages_messaging%' as has_pages_messaging,
  a.scope LIKE '%pages_show_list%' as has_pages_show_list,
  CASE 
    WHEN a.scope LIKE '%pages_messaging%' THEN '✅ Has messaging permission'
    ELSE '❌ Missing pages_messaging scope'
  END as status
FROM accounts a
WHERE a."userId" = (SELECT id FROM users WHERE email = :TEST_EMAIL)
  AND a.provider = 'facebook';

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 2: PAGE CONNECTION VALIDATION
-- ═══════════════════════════════════════════════════════════════════════════

\echo '\n🔎 PHASE 2 — PAGE CONNECTION VALIDATION\n'

-- Query 2.1: Find "Dreamer" Page
\echo '📊 Query 2.1: Facebook Page Details'
SELECT 
  fp.id as page_db_id,
  fp."facebookId" as page_id,
  fp.name,
  fp."tenantId",
  fp."botId",
  fp."engineConnected",
  LENGTH(fp."accessToken") as token_length,
  CASE 
    WHEN fp."accessToken" IS NULL THEN '❌ No access token'
    WHEN LENGTH(fp."accessToken") < 50 THEN '⚠️ Token too short'
    ELSE '✅ Token present'
  END as token_status,
  fp."createdAt",
  fp."updatedAt"
FROM facebook_pages fp
WHERE fp."tenantId" = (SELECT "tenantId" FROM users WHERE email = :TEST_EMAIL)
  AND fp.name ILIKE :PAGE_NAME;

-- Query 2.2: Page Bot Association
\echo '\n📊 Query 2.2: Bot Associated with Page'
SELECT 
  b.id as bot_id,
  b.name as bot_name,
  b.enabled,
  b."tenantId",
  b."entryFlow",
  b."createdAt",
  (SELECT COUNT(*) FROM channels WHERE "botId" = b.id) as channel_count,
  (SELECT COUNT(*) FROM facebook_pages WHERE "botId" = b.id) as page_count
FROM bots b
WHERE b.id = (
  SELECT "botId" FROM facebook_pages 
  WHERE "tenantId" = (SELECT "tenantId" FROM users WHERE email = :TEST_EMAIL)
  AND name ILIKE :PAGE_NAME
);

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 3: FLOW VALIDATION
-- ═══════════════════════════════════════════════════════════════════════════

\echo '\n🔎 PHASE 3 — FLOW VALIDATION\n'

-- Query 3.1: All Flows for Tenant
\echo '📊 Query 3.1: All Flows for Tenant'
SELECT 
  f.id,
  f.name,
  f."isActive",
  f."isGlobal",
  f.version,
  f."createdAt",
  (SELECT COUNT(*) FROM flow_nodes WHERE "flowId" = f.id) as node_count,
  (SELECT COUNT(*) FROM flow_assignments WHERE "flowId" = f.id) as assignment_count,
  (SELECT COUNT(*) FROM flow_assignments WHERE "flowId" = f.id AND "isActive" = true) as active_assignment_count
FROM flows f
WHERE f."tenantId" = (SELECT "tenantId" FROM users WHERE email = :TEST_EMAIL)
ORDER BY f."createdAt" DESC;

-- Query 3.2: ⚠️ CRITICAL - Flow Assignment to "Dreamer" Page
\echo '\n📊 Query 3.2: ⚠️ CRITICAL - Flow Assignment to Dreamer Page'
SELECT 
  f.id as flow_id,
  f.name as flow_name,
  f."isActive" as flow_is_active,
  fa.id as assignment_id,
  fa."isActive" as assignment_is_active,
  fp.id as page_db_id,
  fp.name as page_name,
  fp."facebookId" as page_fb_id,
  CASE 
    WHEN f."isActive" = false THEN '❌ Flow INACTIVE'
    WHEN fa."isActive" = false THEN '❌ Assignment INACTIVE'
    WHEN fa.id IS NULL THEN '❌ NO ASSIGNMENT FOUND'
    ELSE '✅ READY TO EXECUTE'
  END as execution_status
FROM flows f
LEFT JOIN flow_assignments fa ON f.id = fa."flowId"
LEFT JOIN facebook_pages fp ON fa."pageId" = fp.id
WHERE f."tenantId" = (SELECT "tenantId" FROM users WHERE email = :TEST_EMAIL)
  AND fp.name ILIKE :PAGE_NAME;

-- Query 3.3: Flow Nodes (for assigned flow)
\echo '\n📊 Query 3.3: Flow Nodes Detail'
SELECT 
  fn.id,
  fn.type,
  fn."order",
  fn.content,
  f.name as flow_name
FROM flow_nodes fn
JOIN flows f ON fn."flowId" = f.id
WHERE f."tenantId" = (SELECT "tenantId" FROM users WHERE email = :TEST_EMAIL)
ORDER BY f.name, fn."order";

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 4: EXECUTION HISTORY
-- ═══════════════════════════════════════════════════════════════════════════

\echo '\n🔎 PHASE 4 — EXECUTION HISTORY\n'

-- Query 4.1: Flow Sessions (Recent)
\echo '📊 Query 4.1: Recent Flow Execution Sessions'
SELECT 
  fs.id,
  fs."userId" as fb_user_psid,
  fs."pageId",
  fp.name as page_name,
  f.name as flow_name,
  fs."currentNodeId",
  fs."isActive",
  fs."completedAt",
  fs."createdAt" as started_at,
  EXTRACT(EPOCH FROM (COALESCE(fs."completedAt", NOW()) - fs."createdAt")) as duration_seconds
FROM flow_sessions fs
JOIN facebook_pages fp ON fs."pageId" = fp.id
JOIN flows f ON fs."flowId" = f.id
WHERE fp."tenantId" = (SELECT "tenantId" FROM users WHERE email = :TEST_EMAIL)
  AND fp.name ILIKE :PAGE_NAME
ORDER BY fs."createdAt" DESC
LIMIT 10;

-- Query 4.2: Message History
\echo '\n📊 Query 4.2: Recent Messages (Inbound & Outbound)'
SELECT 
  cm.id,
  cm.direction,
  cm.source,
  SUBSTRING(cm.content, 1, 100) as message_preview,
  cm."createdAt",
  c.name as contact_name,
  fp.name as page_name
FROM crm_messages cm
JOIN crm_conversations cc ON cm."conversationId" = cc.id
JOIN contacts c ON cc."contactId" = c.id
JOIN facebook_pages fp ON cc."facebookPageId" = fp.id
WHERE fp."tenantId" = (SELECT "tenantId" FROM users WHERE email = :TEST_EMAIL)
  AND fp.name ILIKE :PAGE_NAME
ORDER BY cm."createdAt" DESC
LIMIT 20;

-- Query 4.3: GET_STARTED Detection
\echo '\n📊 Query 4.3: GET_STARTED / Hi Messages'
SELECT 
  cm.id,
  cm.direction,
  cm.content,
  cm."createdAt",
  c.name as contact_name,
  CASE 
    WHEN cm.content ILIKE '%get started%' THEN '✅ GET_STARTED detected'
    WHEN cm.content ILIKE 'hi' THEN '✅ Postback converted to Hi'
    ELSE 'Other message'
  END as message_type
FROM crm_messages cm
JOIN crm_conversations cc ON cm."conversationId" = cc.id
JOIN contacts c ON cc."contactId" = c.id
JOIN facebook_pages fp ON cc."facebookPageId" = fp.id
WHERE fp."tenantId" = (SELECT "tenantId" FROM users WHERE email = :TEST_EMAIL)
  AND fp.name ILIKE :PAGE_NAME
  AND (cm.content ILIKE '%get started%' OR cm.content ILIKE 'hi')
ORDER BY cm."createdAt" DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 5: SUBSCRIPTION & LIMITS
-- ═══════════════════════════════════════════════════════════════════════════

\echo '\n🔎 PHASE 5 — SUBSCRIPTION & LIMITS\n'

-- Query 5.1: Subscription Status
\echo '📊 Query 5.1: Tenant Subscription'
SELECT 
  s.id,
  s.status,
  p.name as plan_name,
  p."displayName" as plan_display_name,
  p.price / 100.0 as price_usd,
  p."maxFlows" as max_flows_allowed,
  (SELECT COUNT(*) FROM flows WHERE "tenantId" = s."tenantId") as current_flows,
  p."monthlyMessageLimit",
  s."currentPeriodStart",
  s."currentPeriodEnd",
  s."cancelAtPeriodEnd"
FROM subscriptions s
JOIN plans p ON s."planId" = p.id
WHERE s."tenantId" = (SELECT "tenantId" FROM users WHERE email = :TEST_EMAIL);

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 6: COMPLETE HEALTH CHECK
-- ═══════════════════════════════════════════════════════════════════════════

\echo '\n🔎 PHASE 6 — COMPLETE HEALTH CHECK\n'

-- Query 6.1: End-to-End Status
\echo '📊 Query 6.1: Complete Integration Status'
WITH user_data AS (
  SELECT 
    u.id as user_id,
    u."tenantId",
    u.email,
    COUNT(a.id) FILTER (WHERE a.provider = 'facebook') as has_fb_oauth
  FROM users u
  LEFT JOIN accounts a ON u.id = a."userId"
  WHERE u.email = :TEST_EMAIL
  GROUP BY u.id, u."tenantId", u.email
),
page_data AS (
  SELECT 
    fp.id,
    fp.name,
    fp."facebookId",
    fp."engineConnected",
    fp."botId"
  FROM facebook_pages fp
  CROSS JOIN user_data u
  WHERE fp."tenantId" = u."tenantId"
    AND fp.name ILIKE :PAGE_NAME
),
flow_data AS (
  SELECT 
    f.id,
    f.name,
    f."isActive",
    fa.id as assignment_id,
    fa."isActive" as assignment_active
  FROM flows f
  CROSS JOIN user_data u
  LEFT JOIN flow_assignments fa ON f.id = fa."flowId"
  LEFT JOIN page_data p ON fa."pageId" = p.id
  WHERE f."tenantId" = u."tenantId"
    AND p.id IS NOT NULL
)
SELECT 
  'Authentication' as component,
  CASE WHEN ud.has_fb_oauth > 0 THEN '✅ PASS' ELSE '❌ FAIL' END as status,
  'User has Facebook OAuth connected' as check_description
FROM user_data ud

UNION ALL

SELECT 
  'Page Connection',
  CASE WHEN pd.id IS NOT NULL THEN '✅ PASS' ELSE '❌ FAIL' END,
  'Dreamer page found in database'
FROM page_data pd

UNION ALL

SELECT 
  'AI Engine',
  CASE WHEN pd."engineConnected" THEN '✅ PASS' ELSE '⚠️ WARN' END,
  'Page has AI engine enabled'
FROM page_data pd

UNION ALL

SELECT 
  'Bot Instance',
  CASE WHEN pd."botId" IS NOT NULL THEN '✅ PASS' ELSE '⚠️ WARN' END,
  'Bot created for page'
FROM page_data pd

UNION ALL

SELECT 
  'Flow Exists',
  CASE WHEN fd.id IS NOT NULL THEN '✅ PASS' ELSE '❌ FAIL' END,
  'Flow assigned to Dreamer page'
FROM flow_data fd

UNION ALL

SELECT 
  'Flow Active',
  CASE WHEN fd."isActive" THEN '✅ PASS' ELSE '❌ FAIL' END,
  'Flow is activated'
FROM flow_data fd

UNION ALL

SELECT 
  'Assignment Active',
  CASE WHEN fd.assignment_active THEN '✅ PASS' ELSE '❌ FAIL' END,
  'Flow assignment is active'
FROM flow_data fd;

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 7: TROUBLESHOOTING QUERIES
-- ═══════════════════════════════════════════════════════════════════════════

\echo '\n🔎 PHASE 7 — TROUBLESHOOTING QUERIES\n'

-- Query 7.1: Find Inactive Flows That Should Be Active
\echo '📊 Query 7.1: Inactive Flows'
SELECT 
  f.id,
  f.name,
  f."isActive",
  f."updatedAt",
  'Run: UPDATE flows SET "isActive" = true WHERE id = ''' || f.id || ''';' as fix_command
FROM flows f
WHERE f."tenantId" = (SELECT "tenantId" FROM users WHERE email = :TEST_EMAIL)
  AND f."isActive" = false;

-- Query 7.2: Find Unassigned Flows
\echo '\n📊 Query 7.2: Flows Not Assigned to Any Page'
SELECT 
  f.id,
  f.name,
  f."isActive",
  (SELECT COUNT(*) FROM flow_nodes WHERE "flowId" = f.id) as node_count,
  'Assign this flow via /flows/' || f.id || '/settings' as action_needed
FROM flows f
WHERE f."tenantId" = (SELECT "tenantId" FROM users WHERE email = :TEST_EMAIL)
  AND NOT EXISTS (
    SELECT 1 FROM flow_assignments fa 
    WHERE fa."flowId" = f.id AND fa."isActive" = true
  );

-- Query 7.3: Find Pages Without Flows
\echo '\n📊 Query 7.3: Pages Without Active Flows'
SELECT 
  fp.id,
  fp.name,
  fp."engineConnected",
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM flow_assignments fa 
      WHERE fa."pageId" = fp.id AND fa."isActive" = true
    ) THEN 'No active flow assigned'
    ELSE 'Has active flow'
  END as status
FROM facebook_pages fp
WHERE fp."tenantId" = (SELECT "tenantId" FROM users WHERE email = :TEST_EMAIL);

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 8: FIX COMMANDS (If Issues Found)
-- ═══════════════════════════════════════════════════════════════════════════

\echo '\n🔧 PHASE 8 — POTENTIAL FIX COMMANDS\n'
\echo '(Copy and execute if needed)\n'

-- Fix 1: Activate a flow
\echo '-- Fix 1: Activate Flow (replace FLOW_ID)'
\echo 'UPDATE flows SET "isActive" = true WHERE id = ''FLOW_ID'';'
\echo ''

-- Fix 2: Enable AI on page
\echo '-- Fix 2: Enable AI Engine on Page (replace PAGE_ID)'
\echo 'UPDATE facebook_pages SET "engineConnected" = true WHERE id = ''PAGE_ID'';'
\echo ''

-- Fix 3: Create flow assignment
\echo '-- Fix 3: Assign Flow to Page (replace FLOW_ID and PAGE_ID)'
\echo 'INSERT INTO flow_assignments (id, "flowId", "pageId", "isActive", "createdAt", "updatedAt")'
\echo 'VALUES (gen_random_uuid()::text, ''FLOW_ID'', ''PAGE_ID'', true, NOW(), NOW())'
\echo 'ON CONFLICT ("pageId") DO UPDATE SET "flowId" = EXCLUDED."flowId", "isActive" = true;'
\echo ''

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF DIAGNOSTIC QUERIES
-- ═══════════════════════════════════════════════════════════════════════════

\echo '\n✅ Diagnostic queries complete!'
\echo '\n📋 Next Steps:'
\echo '1. Review FAIL/WARN statuses above'
\echo '2. Execute fix commands if needed'
\echo '3. Run: npm run diagnose:facebook for detailed analysis'
\echo '4. Test GET_STARTED trigger again\n'
