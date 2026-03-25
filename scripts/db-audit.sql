-- ============================================================
-- ReplyBase SaaS - Database Audit Script
-- Checks for orphan records, ambiguous data, and seed issues
-- ============================================================

\set ON_ERROR_STOP on

-- ──────────────────────────────────────────────────────────────
-- 1. ROW COUNTS PER TABLE
-- ──────────────────────────────────────────────────────────────
SELECT '=== ROW COUNTS ===' AS section;
SELECT
  tablename,
  (SELECT count(*) FROM information_schema.tables it WHERE it.table_name = pg_tables.tablename) AS exists_check
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

SELECT 'users'                    AS tbl, count(*) FROM users
UNION ALL SELECT 'tenants',                count(*) FROM tenants
UNION ALL SELECT 'bots',                   count(*) FROM bots
UNION ALL SELECT 'channels',               count(*) FROM channels
UNION ALL SELECT 'plans',                  count(*) FROM plans
UNION ALL SELECT 'subscriptions',          count(*) FROM subscriptions
UNION ALL SELECT 'flows',                  count(*) FROM flows
UNION ALL SELECT 'flow_nodes',             count(*) FROM flow_nodes
UNION ALL SELECT 'flow_assignments',       count(*) FROM flow_assignments
UNION ALL SELECT 'flow_channel_assignments', count(*) FROM flow_channel_assignments
UNION ALL SELECT 'flow_sessions',          count(*) FROM flow_sessions
UNION ALL SELECT 'facebook_pages',         count(*) FROM facebook_pages
UNION ALL SELECT 'contacts',               count(*) FROM contacts
UNION ALL SELECT 'contact_identities',     count(*) FROM contact_identities
UNION ALL SELECT 'crm_conversations',      count(*) FROM crm_conversations
UNION ALL SELECT 'crm_messages',           count(*) FROM crm_messages
UNION ALL SELECT 'leads',                  count(*) FROM leads
UNION ALL SELECT 'webchat_sites',          count(*) FROM webchat_sites
UNION ALL SELECT 'webchat_sessions',       count(*) FROM webchat_sessions
UNION ALL SELECT 'webchat_events',         count(*) FROM webchat_events
UNION ALL SELECT 'execution_logs',         count(*) FROM execution_logs
UNION ALL SELECT 'usage_logs',             count(*) FROM usage_logs
UNION ALL SELECT 'activity_logs',          count(*) FROM activity_logs
UNION ALL SELECT 'internal_notes',         count(*) FROM internal_notes
UNION ALL SELECT 'accounts',               count(*) FROM accounts
UNION ALL SELECT 'sessions',               count(*) FROM sessions
UNION ALL SELECT 'webhook_logs',           count(*) FROM webhook_logs
UNION ALL SELECT 'system_health',          count(*) FROM system_health
UNION ALL SELECT 'oidc_models',            count(*) FROM oidc_models
UNION ALL SELECT 'newsletter_subscribers', count(*) FROM newsletter_subscribers
UNION ALL SELECT 'data_deletion_requests', count(*) FROM data_deletion_requests
UNION ALL SELECT 'onboarding_sessions',    count(*) FROM onboarding_sessions
UNION ALL SELECT 'demo_templates',         count(*) FROM demo_templates
UNION ALL SELECT 'onboarding_metrics',     count(*) FROM onboarding_metrics
UNION ALL SELECT 'onboarding_milestone_events', count(*) FROM onboarding_milestone_events
UNION ALL SELECT 'tenant_channel_statuses', count(*) FROM tenant_channel_statuses
UNION ALL SELECT 'tenant_lead_notification_settings', count(*) FROM tenant_lead_notification_settings
ORDER BY tbl;

-- ──────────────────────────────────────────────────────────────
-- 2. ORPHAN CHECKS
-- ──────────────────────────────────────────────────────────────
SELECT '=== ORPHAN: users with no tenant ===' AS check;
SELECT id, email, "tenantId" FROM users WHERE "tenantId" NOT IN (SELECT id FROM tenants);

SELECT '=== ORPHAN: bots with no tenant ===' AS check;
SELECT id, name, "tenantId" FROM bots WHERE "tenantId" NOT IN (SELECT id FROM tenants);

SELECT '=== ORPHAN: channels with no bot ===' AS check;
SELECT id, type, "botId" FROM channels WHERE "botId" NOT IN (SELECT id FROM bots);

SELECT '=== ORPHAN: subscriptions with no tenant ===' AS check;
SELECT id, "tenantId" FROM subscriptions WHERE "tenantId" NOT IN (SELECT id FROM tenants);

SELECT '=== ORPHAN: subscriptions with no plan ===' AS check;
SELECT id, "planId" FROM subscriptions WHERE "planId" NOT IN (SELECT id FROM plans);

SELECT '=== ORPHAN: flows with no tenant ===' AS check;
SELECT id, name, "tenantId" FROM flows WHERE "tenantId" NOT IN (SELECT id FROM tenants);

SELECT '=== ORPHAN: flow_nodes with no flow ===' AS check;
SELECT id, "flowId" FROM flow_nodes WHERE "flowId" NOT IN (SELECT id FROM flows);

SELECT '=== ORPHAN: flow_assignments with no flow ===' AS check;
SELECT id, "flowId" FROM flow_assignments WHERE "flowId" NOT IN (SELECT id FROM flows);

SELECT '=== ORPHAN: flow_assignments with no facebook_page ===' AS check;
SELECT id, "pageId" FROM flow_assignments WHERE "pageId" NOT IN (SELECT id FROM facebook_pages);

SELECT '=== ORPHAN: flow_channel_assignments with no flow ===' AS check;
SELECT id, "flowId" FROM flow_channel_assignments WHERE "flowId" NOT IN (SELECT id FROM flows);

SELECT '=== ORPHAN: flow_channel_assignments with no channel ===' AS check;
SELECT id, "channelId" FROM flow_channel_assignments WHERE "channelId" NOT IN (SELECT id FROM channels);

SELECT '=== ORPHAN: flow_sessions with no flow ===' AS check;
SELECT id, "flowId" FROM flow_sessions WHERE "flowId" NOT IN (SELECT id FROM flows);

SELECT '=== ORPHAN: facebook_pages with no tenant ===' AS check;
SELECT id, name, "tenantId" FROM facebook_pages WHERE "tenantId" NOT IN (SELECT id FROM tenants);

SELECT '=== ORPHAN: facebook_pages pointing to nonexistent bot ===' AS check;
SELECT id, name, "botId" FROM facebook_pages WHERE "botId" IS NOT NULL AND "botId" NOT IN (SELECT id FROM bots);

SELECT '=== ORPHAN: contacts with no tenant ===' AS check;
SELECT id, "tenantId" FROM contacts WHERE "tenantId" NOT IN (SELECT id FROM tenants);

SELECT '=== ORPHAN: contact_identities with no contact ===' AS check;
SELECT id, "contactId" FROM contact_identities WHERE "contactId" NOT IN (SELECT id FROM contacts);

SELECT '=== ORPHAN: crm_conversations with no contact ===' AS check;
SELECT id, "contactId" FROM crm_conversations WHERE "contactId" NOT IN (SELECT id FROM contacts);

SELECT '=== ORPHAN: crm_conversations pointing to nonexistent bot ===' AS check;
SELECT id, "botId" FROM crm_conversations WHERE "botId" IS NOT NULL AND "botId" NOT IN (SELECT id FROM bots);

SELECT '=== ORPHAN: crm_conversations pointing to nonexistent facebook_page ===' AS check;
SELECT id, "facebookPageId" FROM crm_conversations WHERE "facebookPageId" IS NOT NULL AND "facebookPageId" NOT IN (SELECT id FROM facebook_pages);

SELECT '=== ORPHAN: crm_conversations pointing to nonexistent assignee ===' AS check;
SELECT id, "assigneeId" FROM crm_conversations WHERE "assigneeId" IS NOT NULL AND "assigneeId" NOT IN (SELECT id FROM users);

SELECT '=== ORPHAN: crm_messages with no conversation ===' AS check;
SELECT id, "conversationId" FROM crm_messages WHERE "conversationId" NOT IN (SELECT id FROM crm_conversations);

SELECT '=== ORPHAN: leads with no tenant ===' AS check;
SELECT id, "tenantId" FROM leads WHERE "tenantId" NOT IN (SELECT id FROM tenants);

SELECT '=== ORPHAN: leads pointing to nonexistent contact ===' AS check;
SELECT id, "contactId" FROM leads WHERE "contactId" IS NOT NULL AND "contactId" NOT IN (SELECT id FROM contacts);

SELECT '=== ORPHAN: leads pointing to nonexistent flow ===' AS check;
SELECT id, "flowId" FROM leads WHERE "flowId" IS NOT NULL AND "flowId" NOT IN (SELECT id FROM flows);

SELECT '=== ORPHAN: leads pointing to nonexistent facebook_page ===' AS check;
SELECT id, "pageId" FROM leads WHERE "pageId" IS NOT NULL AND "pageId" NOT IN (SELECT id FROM facebook_pages);

SELECT '=== ORPHAN: webchat_sites with no bot ===' AS check;
SELECT id, "botId" FROM webchat_sites WHERE "botId" NOT IN (SELECT id FROM bots);

SELECT '=== ORPHAN: webchat_sites with no tenant ===' AS check;
SELECT id, "tenantId" FROM webchat_sites WHERE "tenantId" NOT IN (SELECT id FROM tenants);

SELECT '=== ORPHAN: webchat_sites pointing to nonexistent channel ===' AS check;
SELECT id, "channelId" FROM webchat_sites WHERE "channelId" IS NOT NULL AND "channelId" NOT IN (SELECT id FROM channels);

SELECT '=== ORPHAN: webchat_sessions with no site ===' AS check;
SELECT id, "siteId" FROM webchat_sessions WHERE "siteId" NOT IN (SELECT id FROM webchat_sites);

SELECT '=== ORPHAN: webchat_sessions with no conversation ===' AS check;
SELECT id, "conversationId" FROM webchat_sessions WHERE "conversationId" NOT IN (SELECT id FROM crm_conversations);

SELECT '=== ORPHAN: webchat_events with no site ===' AS check;
SELECT id, "siteId" FROM webchat_events WHERE "siteId" NOT IN (SELECT id FROM webchat_sites);

SELECT '=== ORPHAN: webchat_events pointing to nonexistent session ===' AS check;
SELECT id, "sessionId" FROM webchat_events WHERE "sessionId" IS NOT NULL AND "sessionId" NOT IN (SELECT id FROM webchat_sessions);

SELECT '=== ORPHAN: execution_logs with no bot ===' AS check;
SELECT id, "botId" FROM execution_logs WHERE "botId" NOT IN (SELECT id FROM bots);

SELECT '=== ORPHAN: execution_logs with no user ===' AS check;
SELECT id, "userId" FROM execution_logs WHERE "userId" NOT IN (SELECT id FROM users);

SELECT '=== ORPHAN: usage_logs with no tenant ===' AS check;
SELECT id, "tenantId" FROM usage_logs WHERE "tenantId" NOT IN (SELECT id FROM tenants);

SELECT '=== ORPHAN: usage_logs pointing to nonexistent bot ===' AS check;
SELECT id, "botId" FROM usage_logs WHERE "botId" IS NOT NULL AND "botId" NOT IN (SELECT id FROM bots);

SELECT '=== ORPHAN: usage_logs pointing to nonexistent user ===' AS check;
SELECT id, "userId" FROM usage_logs WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM users);

SELECT '=== ORPHAN: internal_notes with no conversation ===' AS check;
SELECT id, "conversationId" FROM internal_notes WHERE "conversationId" NOT IN (SELECT id FROM crm_conversations);

SELECT '=== ORPHAN: internal_notes with no author ===' AS check;
SELECT id, "authorId" FROM internal_notes WHERE "authorId" NOT IN (SELECT id FROM users);

SELECT '=== ORPHAN: accounts with no user ===' AS check;
SELECT id, "userId" FROM accounts WHERE "userId" NOT IN (SELECT id FROM users);

SELECT '=== ORPHAN: sessions with no user ===' AS check;
SELECT id, "userId" FROM sessions WHERE "userId" NOT IN (SELECT id FROM users);

SELECT '=== ORPHAN: activity_logs with no tenant ===' AS check;
SELECT id, "tenantId" FROM activity_logs WHERE "tenantId" NOT IN (SELECT id FROM tenants);

SELECT '=== ORPHAN: onboarding_sessions with no contact ===' AS check;
SELECT id, "contactId" FROM onboarding_sessions WHERE "contactId" NOT IN (SELECT id FROM contacts);

SELECT '=== ORPHAN: onboarding_sessions with no facebook_page ===' AS check;
SELECT id, "facebookPageId" FROM onboarding_sessions WHERE "facebookPageId" NOT IN (SELECT id FROM facebook_pages);

SELECT '=== ORPHAN: tenant_channel_statuses with no tenant ===' AS check;
SELECT id, "tenantId" FROM tenant_channel_statuses WHERE "tenantId" NOT IN (SELECT id FROM tenants);

SELECT '=== ORPHAN: tenant_lead_notification_settings with no tenant ===' AS check;
SELECT id, "tenantId" FROM tenant_lead_notification_settings WHERE "tenantId" NOT IN (SELECT id FROM tenants);

SELECT '=== ORPHAN: onboarding_milestone_events with no tenant ===' AS check;
SELECT id, "tenantId" FROM onboarding_milestone_events WHERE "tenantId" NOT IN (SELECT id FROM tenants);

SELECT '=== ORPHAN: newsletter_subscribers pointing to nonexistent user ===' AS check;
SELECT id, "userId" FROM newsletter_subscribers WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM users);

SELECT '=== ORPHAN: newsletter_subscribers pointing to nonexistent tenant ===' AS check;
SELECT id, "tenantId" FROM newsletter_subscribers WHERE "tenantId" IS NOT NULL AND "tenantId" NOT IN (SELECT id FROM tenants);

SELECT '=== ORPHAN: data_deletion_requests pointing to nonexistent user ===' AS check;
SELECT id, "userId" FROM data_deletion_requests WHERE "userId" IS NOT NULL AND "userId" NOT IN (SELECT id FROM users);

SELECT '=== ORPHAN: data_deletion_requests pointing to nonexistent tenant ===' AS check;
SELECT id, "tenantId" FROM data_deletion_requests WHERE "tenantId" IS NOT NULL AND "tenantId" NOT IN (SELECT id FROM tenants);

-- ──────────────────────────────────────────────────────────────
-- 3. AMBIGUITY / DANGLING REFERENCES
-- ──────────────────────────────────────────────────────────────

SELECT '=== AMBIGUITY: tenants with no users ===' AS check;
SELECT id, name FROM tenants WHERE id NOT IN (SELECT DISTINCT "tenantId" FROM users);

SELECT '=== AMBIGUITY: tenants with no subscription ===' AS check;
SELECT id, name FROM tenants WHERE id NOT IN (SELECT "tenantId" FROM subscriptions);

SELECT '=== AMBIGUITY: bots with no channels ===' AS check;
SELECT b.id, b.name, b."tenantId" FROM bots b WHERE b.id NOT IN (SELECT "botId" FROM channels);

SELECT '=== AMBIGUITY: flows with no nodes ===' AS check;
SELECT id, name, "tenantId" FROM flows WHERE id NOT IN (SELECT DISTINCT "flowId" FROM flow_nodes);

SELECT '=== AMBIGUITY: stale flow_sessions (isActive=true, completedAt IS NULL, older than 24h) ===' AS check;
SELECT id, "flowId", "userId", "pageId", "createdAt" FROM flow_sessions WHERE "isActive" = true AND "completedAt" IS NULL AND "createdAt" < NOW() - INTERVAL '24 hours';

SELECT '=== AMBIGUITY: expired NextAuth sessions ===' AS check;
SELECT id, "userId", expires FROM sessions WHERE expires < NOW();

SELECT '=== AMBIGUITY: expired OIDC models ===' AS check;
SELECT id, type, "expiresAt" FROM oidc_models WHERE "expiresAt" IS NOT NULL AND "expiresAt" < NOW();

SELECT '=== AMBIGUITY: duplicate flow_channel_assignments for same channel ===' AS check;
SELECT "channelId", count(*) FROM flow_channel_assignments GROUP BY "channelId" HAVING count(*) > 1;

SELECT '=== AMBIGUITY: duplicate flow_assignments for same page ===' AS check;
SELECT "pageId", count(*) FROM flow_assignments GROUP BY "pageId" HAVING count(*) > 1;

SELECT '=== AMBIGUITY: contacts with duplicate emails per tenant ===' AS check;
SELECT "tenantId", email, count(*) FROM contacts WHERE email IS NOT NULL GROUP BY "tenantId", email HAVING count(*) > 1;

SELECT '=== AMBIGUITY: contacts with duplicate phones per tenant ===' AS check;
SELECT "tenantId", phone, count(*) FROM contacts WHERE phone IS NOT NULL GROUP BY "tenantId", phone HAVING count(*) > 1;

SELECT '=== AMBIGUITY: webchat_sites with no sessions ===' AS check;
SELECT id, name, "tenantId", "createdAt" FROM webchat_sites WHERE id NOT IN (SELECT DISTINCT "siteId" FROM webchat_sessions);

SELECT '=== AMBIGUITY: seed-flow orphan nodes (hardcoded flow IDs that dont exist) ===' AS check;
SELECT fn."flowId", count(*) AS orphan_nodes
FROM flow_nodes fn
WHERE fn."flowId" NOT IN (SELECT id FROM flows)
GROUP BY fn."flowId";

-- ──────────────────────────────────────────────────────────────
-- 4. SEED DATA CHECKS
-- ──────────────────────────────────────────────────────────────
SELECT '=== SEED: Plans ===' AS check;
SELECT id, name, "displayName", price, currency, "maxBots", "maxFlows" FROM plans ORDER BY price;

SELECT '=== SEED: Demo Templates ===' AS check;
SELECT id, name, "displayName", "businessType", enabled, "order" FROM demo_templates ORDER BY "order";

SELECT '=== SEED: seed-flows.sql hardcoded tenant ID check ===' AS check;
SELECT EXISTS(SELECT 1 FROM tenants WHERE id = 'cmliz8ul8000013t5xffrwlok') AS "seed_tenant_exists";

SELECT '=== SEED: Global flows (isGlobal=true) and their tenant ===' AS check;
SELECT f.id, f.name, f."tenantId", t.name AS tenant_name, f."isActive"
FROM flows f
LEFT JOIN tenants t ON t.id = f."tenantId"
WHERE f."isGlobal" = true;

SELECT '=== SEED: System health records ===' AS check;
SELECT * FROM system_health;

-- ──────────────────────────────────────────────────────────────
-- 5. LEGACY TYPEBOT TABLE SIZES (public.Account etc)
-- ──────────────────────────────────────────────────────────────
SELECT '=== LEGACY Typebot table counts ===' AS check;
SELECT 'Typebot'                 AS tbl, count(*) FROM "Typebot"
UNION ALL SELECT 'Workspace',            count(*) FROM "Workspace"
UNION ALL SELECT 'Result',               count(*) FROM "Result"
UNION ALL SELECT 'Answer',               count(*) FROM "Answer"
UNION ALL SELECT 'AnswerV2',             count(*) FROM "AnswerV2"
UNION ALL SELECT 'Log',                  count(*) FROM "Log"
UNION ALL SELECT 'User (legacy)',        count(*) FROM "User"
UNION ALL SELECT 'Account (legacy)',     count(*) FROM "Account"
UNION ALL SELECT 'Session (legacy)',     count(*) FROM "Session"
UNION ALL SELECT 'ChatSession',          count(*) FROM "ChatSession"
UNION ALL SELECT 'OidcModel',            count(*) FROM oidc_models
ORDER BY tbl;
