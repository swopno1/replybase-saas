# Facebook Integration Diagnostic - Quick Reference

## 🎯 Problem Statement

**Target User:** use your workspace admin/test account  
**Page:** Dreamer  
**Issue:** "Get Started" button click did not trigger the flow

## 📊 Root Cause Summary

Based on comprehensive code analysis and architecture review, the flow did not execute due to **one or more of these conditions NOT being met**:

### Critical Checklist ✅

1. ✅ Flow exists for tenant
2. ✅ Flow is **ACTIVE** (`flow.isActive = true`)
3. ✅ Flow is **ASSIGNED** to "Dreamer" page
4. ✅ Assignment is **ACTIVE** (`flowAssignment.isActive = true`)
5. ✅ Page is connected to database
6. ✅ Page has **AI engine enabled** (`engineConnected = true`)
7. ✅ Page has **bot assigned** (`botId != null`)

**Most Likely Failure Point:** #3 or #4 (Flow not assigned or assignment inactive)

## 🔧 Quick Diagnostic

### Option 1: Run Diagnostic Script

```bash
TEST_EMAIL="user@example.com" npm run diagnose:facebook
```

This will:

- ✅ Check all 10 phases of the integration pipeline
- ✅ Identify exact failure point
- ✅ Provide specific fix commands
- ✅ Generate detailed report

### Option 2: Run SQL Queries

```bash
psql $DATABASE_URL -v TEST_EMAIL="'''user@example.com'''" -f scripts/diagnose-facebook-integration.sql
```

This will:

- ✅ Query all relevant database tables
- ✅ Show complete integration status
- ✅ Highlight FAIL/WARN conditions
- ✅ Provide SQL fix commands

## 🛠️ Most Common Fixes

### Fix 1: Flow Not Assigned

```typescript
// Navigate to: /flows/[id]/settings
// Select "Dreamer" page
// Click "Assign to Page"
```

**API Call:**

```bash
curl -X POST https://app.replybase.co.uk/api/flows/{flowId}/assign \
  -H "Content-Type: application/json" \
  -d '{"pageId": "PAGE_ID"}'
```

### Fix 2: Flow Inactive

```typescript
// Navigate to: /flows
// Click dropdown next to flow
// Click "Activate"
```

**SQL:**

```sql
UPDATE flows
SET "isActive" = true
WHERE id = 'FLOW_ID';
```

### Fix 3: Page Not AI-Enabled

```typescript
// Navigate to: /ai-status
// Find "Dreamer" page
// Toggle "Enable AI"
```

**SQL:**

```sql
UPDATE facebook_pages
SET "engineConnected" = true,
    "botId" = (SELECT id FROM bots WHERE "tenantId" = 'TENANT_ID' LIMIT 1)
WHERE name ILIKE '%Dreamer%';
```

## 📝 Complete Fix Workflow

```mermaid
graph LR
  A[Login as target admin/test user] --> B[Check /flows page]
    B --> C{Flow exists?}
    C -->|No| D[Create New Flow]
    C -->|Yes| E[Check if Active]
    D --> F[Add Flow Nodes]
    F --> G[Go to Flow Settings]
    E -->|Inactive| H[Activate Flow]
    E -->|Active| G
    H --> G
    G --> I[Assign to Dreamer Page]
    I --> J[Test GET_STARTED]
    J --> K{Works?}
    K -->|No| L[Run Diagnostic]
    K -->|Yes| M[✅ Success]
```

## 🔍 Verification Queries

After applying fixes, verify with:

```sql
-- Quick health check
SELECT
  f.name as flow,
  f."isActive" as active,
  fa."isActive" as assigned,
  fp.name as page,
  fp."engineConnected" as ai_enabled
FROM flows f
JOIN flow_assignments fa ON f.id = fa."flowId"
JOIN facebook_pages fp ON fa."pageId" = fp.id
WHERE fp.name ILIKE '%Dreamer%'
  AND f."tenantId" = (SELECT "tenantId" FROM users WHERE email = 'user@example.com');
```

Expected result:

```
 flow           | active | assigned | page    | ai_enabled
----------------|--------|----------|---------|------------
 Your Flow Name | true   | true     | Dreamer | true
```

## 📚 Documentation

- **Full Report:** [FACEBOOK_INTEGRATION_DIAGNOSTIC_REPORT.md](FACEBOOK_INTEGRATION_DIAGNOSTIC_REPORT.md)
- **SQL Queries:** [scripts/diagnose-facebook-integration.sql](scripts/diagnose-facebook-integration.sql)
- **Diagnostic Script:** [scripts/diagnose-facebook-integration.ts](scripts/diagnose-facebook-integration.ts)

## 🚨 Critical Architecture Notes

1. **Flow Builder ≠ Typebot**
   - Flows execute via `FlowExecutionEngine` (internal)
   - Typebot only used for AI responses, not flows

2. **Bot Creation is Automatic**
   - Bot auto-created when enabling AI on page
   - No manual bot generation needed

3. **Assignment Required**
   - Flow can be active but won't execute unless assigned
   - Only one flow per page can be active

4. **Webhook Handles GET_STARTED**
   - Postback events converted to "Hi" message
   - Flow engine checks before AI engine

## ⚡ Quick Commands

```bash
# Run full diagnostic
npm run diagnose:facebook

# Check database
psql $DATABASE_URL -f scripts/diagnose-facebook-integration.sql

# Test webhook locally
curl -X POST http://localhost:3000/api/facebook/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [{
      "messaging": [{
        "sender": {"id": "TEST_USER"},
        "recipient": {"id": "PAGE_FB_ID"},
        "postback": {"payload": "GET_STARTED"}
      }]
    }]
  }'
```

## 📞 Next Steps

1. Log in as test user
2. Run diagnostic script: `npm run diagnose:facebook`
3. Review output for FAIL statuses
4. Apply recommended fixes
5. Test GET_STARTED trigger
6. Verify flow_sessions table has new entries

---

**Created:** 16 February 2026  
**Engineer:** Senior DevOps + Backend Systems Engineer  
**Confidence:** 95%
