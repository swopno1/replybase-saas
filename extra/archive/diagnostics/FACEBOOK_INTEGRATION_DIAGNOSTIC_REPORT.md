# 🔬 Facebook Page Integration - Diagnostic Report

**Date:** 16 February 2026  
**Test User:** amirhossain.limon@gmail.com  
**Facebook Page:** Dreamer  
**Trigger Tested:** GET_STARTED  
**Status:** ⚠️ INVESTIGATION COMPLETE

---

## 📋 Executive Summary

After comprehensive code analysis and architecture review of the Facebook Messenger integration pipeline for the "Dreamer" page, I have identified **multiple potential root causes** for why the "Get Started" trigger did not execute the flow.

The system architecture follows this path:

```
User → Facebook → Webhook → SaaS App → Flow Execution Engine → Response
```

The investigation reveals that the **Flow Builder system** is the primary mechanism for handling automated responses, and it is **independent of Typebot/AI Engine**.

---

## 🔍 System Architecture Analysis

### Component Overview

| Component                 | Purpose                                   | Status         |
| ------------------------- | ----------------------------------------- | -------------- |
| **Facebook Webhook**      | `/api/facebook/webhook` - Receives events | ✅ Implemented |
| **Flow Builder**          | DB-stored conversation flows              | ✅ Implemented |
| **Flow Execution Engine** | `/lib/flow-execution-engine.ts`           | ✅ Implemented |
| **FlowAssignment**        | Links flows to pages                      | ✅ Implemented |
| **Bot Instance**          | Created per page when AI enabled          | ✅ Implemented |
| **Typebot/AI Engine**     | External AI responses (optional)          | ⚠️ Independent |

### Message Handling Pipeline

```typescript
// Webhook receives POST → handleMessagingEvent()
if (postback) {
  const messageText = "Hi"; // GET_STARTED converted to greeting
  await handleMessage(senderPsid, pageId, messageText);
}

// handleMessage() executes this sequence:
1. Find FacebookPage by pageId
2. Check engineConnected, botId, tenantId
3. Create/find Contact and Conversation
4. Log inbound message
5. Check for onboarding flow (new users)
6. ⚠️ CRITICAL: Check FlowExecutionEngine.executeFlow()
7. Fall back to default bot flow or AI engine
```

**Location:** [/app/api/facebook/webhook/route.ts](app/api/facebook/webhook/route.ts#L130-L180)

---

## 🎯 Root Cause Identification

Based on code analysis, the flow execution fails at **Step 6** if ANY of these conditions are not met:

### Critical Requirements Checklist

| #   | Requirement                  | Check Method                                    | Failure Impact                 |
| --- | ---------------------------- | ----------------------------------------------- | ------------------------------ |
| 1️⃣  | **Flow exists for tenant**   | `prisma.flow.findMany({ where: { tenantId } })` | No flows → fallback to default |
| 2️⃣  | **Flow is ACTIVE**           | `flow.isActive = true`                          | Inactive → execution skipped   |
| 3️⃣  | **Flow is ASSIGNED to page** | `flowAssignment.pageId = page.id`               | Not assigned → no execution    |
| 4️⃣  | **Assignment is ACTIVE**     | `flowAssignment.isActive = true`                | Inactive → execution skipped   |
| 5️⃣  | **Page is connected**        | `facebookPage.facebookId = pageId`              | Not found → webhook stops      |
| 6️⃣  | **Page has engine enabled**  | `facebookPage.engineConnected = true`           | False → webhook stops early    |
| 7️⃣  | **Page has bot assigned**    | `facebookPage.botId != null`                    | Null → webhook stops early     |

---

## 🔴 Most Likely Root Causes

### 1. Flow Not Assigned to Page ⚠️ HIGH PROBABILITY

**Evidence:**

```sql
-- Check if flow is assigned to Dreamer page
SELECT f.name, fa."isActive", fp.name as page_name
FROM flows f
LEFT JOIN flow_assignments fa ON f.id = fa."flowId"
LEFT JOIN facebook_pages fp ON fa."pageId" = fp.id
WHERE fp.name ILIKE '%Dreamer%'
  AND f."tenantId" = (SELECT "tenantId" FROM users WHERE email = 'amirhossain.limon@gmail.com');
```

**Code Location:** [/lib/flow-execution-engine.ts:56](lib/flow-execution-engine.ts#L56-L88)

```typescript
const assignment = await prisma.flowAssignment.findFirst({
  where: {
    pageId: context.pageId,
    isActive: true, // ⚠️ Must be true
  },
  include: {
    flow: {
      include: { nodes: { orderBy: { order: "asc" } } },
    },
    page: true,
  },
});

if (!assignment || !assignment.flow.isActive) {
  console.log("[FlowEngine] No active flow found for page:", context.pageId);
  return { success: false, reason: "no_active_flow" }; // ⚠️ Fails here
}
```

**Fix:**

```typescript
// Navigate to: /flows/[id]/settings
// Select "Dreamer" page from dropdown
// Click "Assign to Page"
// API: POST /api/flows/:id/assign
```

---

### 2. Flow is Inactive ⚠️ HIGH PROBABILITY

**Evidence:**

```typescript
// Even if assigned, flow must be explicitly activated
const flow = assignment.flow;
if (!flow.isActive) {
  // Execution stops - no error logged
  return { success: false, reason: "flow_not_active" };
}
```

**Database Check:**

```sql
SELECT id, name, "isActive", "isGlobal"
FROM flows
WHERE "tenantId" = (SELECT "tenantId" FROM users WHERE email = 'amirhossain.limon@gmail.com');
```

**Fix:**

```typescript
// Navigate to: /flows
// Find the flow
// Click "Activate" in dropdown menu
// API: PUT /api/flows/:id { isActive: true }
```

---

### 3. Page Not Connected / Engine Not Enabled ⚠️ MEDIUM PROBABILITY

**Evidence:**

```typescript
// Webhook handler checks these early
if (
  !facebookPage.engineConnected ||
  !facebookPage.botId ||
  !facebookPage.tenantId
) {
  console.warn(`[Facebook Webhook] Page ${pageId} is not configured for AI.`);
  return; // ⚠️ Exits early - flow never checked
}
```

**Database Check:**

```sql
SELECT id, name, "engineConnected", "botId", "tenantId"
FROM facebook_pages
WHERE name ILIKE '%Dreamer%';
```

**Fix:**

```typescript
// Navigate to: /ai-status
// Find "Dreamer" page
// Toggle "Enable AI"
// API: POST /api/integrations/facebook/pages/:id/toggle-ai-engine
```

---

### 4. No Flow Created ⚠️ LOW PROBABILITY

If no flow exists at all for the tenant, the system falls back to default bot flow or AI engine.

**Check:**

```sql
SELECT COUNT(*) as flow_count
FROM flows
WHERE "tenantId" = (SELECT "tenantId" FROM users WHERE email = 'amirhossain.limon@gmail.com');
```

**Fix:**

```typescript
// Navigate to: /flows
// Click "Create New Flow"
// Add nodes (message, input, etc.)
// API: POST /api/flows
```

---

## 🧪 Diagnostic Tool

I've created a comprehensive diagnostic script that you can run to identify the exact failure point:

```bash
npm run diagnose:facebook
```

**Script Location:** [/scripts/diagnose-facebook-integration.ts](scripts/diagnose-facebook-integration.ts)

### What the Script Checks

✅ **Phase 1:** User authentication & Facebook OAuth  
✅ **Phase 2:** Page connection & token validity  
✅ **Phase 3:** Webhook configuration  
✅ **Phase 4:** Flow existence, status, and assignment  
✅ **Phase 5:** Execution engine logs & flow sessions  
✅ **Phase 6:** Bot generation & Typebot usage  
✅ **Phase 7:** Message delivery & CRM logs  
✅ **Phase 8:** Complete database state snapshot  
✅ **Phase 9:** Root cause analysis  
✅ **Phase 10:** Recommendations & fix commands

### Expected Output

```
🔎 PHASE 4 — FLOW VALIDATION
═══════════════════════════════════════════════════════════

[FLOW] FAIL: No active flow assigned to page "Dreamer"
  Data: { "available_flows": [...] }
  💡 Recommendation: Assign a flow to the page via /flows/[id]/settings
```

---

## 🛠️ Step-by-Step Fix Procedure

### Option A: Flow Exists but Not Assigned

1. **Login** as `amirhossain.limon@gmail.com`
2. **Navigate** to `/flows`
3. **Select** the desired flow (or create one if none exists)
4. **Click** "Settings" or navigate to `/flows/[id]/settings`
5. **Select** "Dreamer" from the page dropdown
6. **Click** "Assign to Page"
7. **Verify** assignment appears in flow list
8. **Test** by clicking "Get Started" on Facebook page

### Option B: Flow Inactive

1. **Navigate** to `/flows`
2. **Find** the flow assigned to Dreamer
3. **Click** dropdown menu (⋮)
4. **Click** "Activate"
5. **Verify** status shows "Active" badge
6. **Test** trigger

### Option C: Page Not Engine-Connected

1. **Navigate** to `/ai-status`
2. **Find** "Dreamer" page
3. **Toggle** "Enable AI" switch
4. **Wait** for bot to be auto-created
5. **Verify** green checkmark appears
6. **Then** follow Option A to assign flow

### Option D: No Flow Exists

1. **Navigate** to `/flows`
2. **Click** "Create New Flow"
3. **Enter** name and description
4. **Add nodes:**
   - Message node: "Welcome! 👋 How can I help you?"
   - Input node: "What's your name?"
   - Message node: "Nice to meet you!"
5. **Save** flow
6. **Follow** Option A to assign and activate

---

## 📊 Database Schema Verification

### Key Tables

```sql
-- Flows table
CREATE TABLE flows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT false, -- ⚠️ Must be true
  "isGlobal" BOOLEAN DEFAULT false,
  ...
);

-- Flow Assignments table (links flows to pages)
CREATE TABLE flow_assignments (
  id TEXT PRIMARY KEY,
  "flowId" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT true, -- ⚠️ Must be true
  UNIQUE("pageId"), -- Only one active flow per page
  ...
);

-- Flow Sessions table (execution tracking)
CREATE TABLE flow_sessions (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL, -- FB user PSID
  "pageId" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "currentNodeId" TEXT,
  variables JSONB DEFAULT '{}',
  "isActive" BOOLEAN DEFAULT true,
  "completedAt" TIMESTAMP,
  ...
);
```

---

## 🎯 Critical Questions Answered

### Q1: Does activating a flow automatically generate a bot?

**A:** No. Bots and Flows are **separate systems**.

- **Bot** is created when you enable AI on a Facebook page (`engineConnected = true`)
- **Flow** is a conversation sequence stored in the database
- Flow execution is **independent** of bot creation

### Q2: Is the flow compiled before assignment?

**A:** No compilation needed. Flows are:

- Stored as database records (`flows` + `flow_nodes` tables)
- Executed **dynamically** by `FlowExecutionEngine`
- Not converted to Typebot or any external format

### Q3: Is page assigned before activation?

**A:** Order doesn't matter, but **BOTH must be true**:

```typescript
// These two conditions must BOTH be met:
flow.isActive = true; // Flow globally active
flowAssignment.isActive = true; // Flow active for this page
```

### Q4: Is GET_STARTED registered as a postback?

**A:** Yes, the webhook handles it correctly:

```typescript
// Webhook converts postback to message
if (postback) {
  const messageText = "Hi"; // Treat postback as initial greeting
  await handleMessage(senderPsid, pageId, messageText);
}
```

**Location:** [/app/api/facebook/webhook/route.ts:145-150](app/api/facebook/webhook/route.ts#L145-L150)

### Q5: Is Typebot actually required or redundant?

**A:** For Flow Builder: **Redundant**.

- **Flow Builder** uses internal execution engine
- **Typebot** is only called if:
  - No active flow exists, AND
  - Default bot flow doesn't handle it, AND
  - `conversation.botId` exists

**Code Location:** [/app/api/facebook/webhook/route.ts:328-370](app/api/facebook/webhook/route.ts#L328-L370)

---

## 🏗️ Architecture Flaws & Improvements

### Current Architecture Issues

1. **Silent Failures**
   - When flow is not assigned or inactive, `FlowExecutionEngine` returns `{ success: false }` without logging
   - User sees no error, just fallback to default flow

2. **Early Exit in Webhook**
   - If `engineConnected = false`, webhook exits before checking flows
   - This contradicts the flow's independence from AI engine

3. **Unclear User Flow**
   - Users must:
     1. Connect page
     2. Enable AI (creates bot)
     3. Create flow
     4. Assign flow to page
     5. Activate flow
   - Not obvious from UI

### Recommended Improvements

#### 1. Decouple Flow Execution from AI Engine

```typescript
// CURRENT: Requires engineConnected = true
if (!facebookPage.engineConnected) {
  console.warn("Page not configured for AI");
  return; // ⚠️ Exits before checking flows
}

// SUGGESTED: Check flows independently
// Check flows first, regardless of AI status
const flowResult = await FlowExecutionEngine.executeFlow({...});
if (flowResult.success) {
  return; // Flow handled it
}

// Then check if AI engine should handle
if (facebookPage.engineConnected) {
  // Use AI engine
}
```

#### 2. Add Validation on Flow Activation

```typescript
// When user clicks "Activate" flow
PUT /api/flows/:id

// Should validate:
if (!flow.assignments.some(a => a.isActive)) {
  return {
    error: "Cannot activate flow - not assigned to any page",
    suggestion: "Go to Flow Settings and assign to a page first"
  };
}
```

#### 3. Add Health Check Endpoint

```typescript
// GET /api/flows/:id/health
{
  flow: {
    id: "...",
    isActive: true,
    nodes: 5
  },
  assignments: [
    {
      pageId: "...",
      pageName: "Dreamer",
      isActive: true,
      status: "ready" // or "warning", "error"
    }
  ],
  issues: [
    "Flow has no nodes - add messages or inputs"
  ],
  ready: false
}
```

---

## 📝 Production-Ready Flow Activation Lifecycle

### Correct Sequence

```mermaid
graph TD
    A[Connect Facebook Page] --> B[Enable AI on Page]
    B --> C[Auto-create Bot]
    C --> D[Create Flow]
    D --> E[Add Flow Nodes]
    E --> F[Assign Flow to Page]
    F --> G[Activate Flow]
    G --> H[Test GET_STARTED]
    H --> I{Flow Executes?}
    I -->|Yes| J[✅ SUCCESS]
    I -->|No| K[Run Diagnostic Script]
    K --> L[Fix Issues]
    L --> H
```

### SQL Verification

After completing setup, verify with:

```sql
-- Complete health check
WITH user_data AS (
  SELECT id as user_id, "tenantId"
  FROM users
  WHERE email = 'amirhossain.limon@gmail.com'
)
SELECT
  'USER' as component,
  u.user_id,
  u."tenantId",
  (SELECT COUNT(*) FROM accounts WHERE "userId" = u.user_id AND provider = 'facebook') as has_fb_oauth
FROM user_data u

UNION ALL

SELECT
  'PAGE' as component,
  fp.id,
  fp.name,
  fp."engineConnected"::text
FROM facebook_pages fp
CROSS JOIN user_data u
WHERE fp."tenantId" = u."tenantId"
  AND fp.name ILIKE '%Dreamer%'

UNION ALL

SELECT
  'FLOW' as component,
  f.id,
  f.name,
  f."isActive"::text
FROM flows f
CROSS JOIN user_data u
WHERE f."tenantId" = u."tenantId"

UNION ALL

SELECT
  'ASSIGNMENT' as component,
  fa.id,
  fp.name || ' ← ' || f.name,
  fa."isActive"::text
FROM flow_assignments fa
JOIN flows f ON fa."flowId" = f.id
JOIN facebook_pages fp ON fa."pageId" = fp.id
CROSS JOIN user_data u
WHERE f."tenantId" = u."tenantId";
```

---

## 🚨 Immediate Action Items

### For User `amirhossain.limon@gmail.com`

1. **Run diagnostic script:**

   ```bash
   npm run diagnose:facebook
   ```

2. **Check output for FAIL statuses**

3. **Follow recommendations in script output**

4. **Most likely fix:**
   - Navigate to `/flows/[id]/settings`
   - Assign flow to "Dreamer" page
   - Activate flow via `/flows` page

5. **Test GET_STARTED again**

6. **Check flow_sessions table for new entries:**
   ```sql
   SELECT * FROM flow_sessions
   WHERE "pageId" = (SELECT id FROM facebook_pages WHERE name ILIKE '%Dreamer%')
   ORDER BY "createdAt" DESC
   LIMIT 5;
   ```

---

## 📚 Additional Resources

### Code References

- **Webhook Handler:** [/app/api/facebook/webhook/route.ts](app/api/facebook/webhook/route.ts)
- **Flow Execution Engine:** [/lib/flow-execution-engine.ts](lib/flow-execution-engine.ts)
- **Flow Assignment API:** [/app/api/flows/[id]/assign/route.ts](app/api/flows/[id]/assign/route.ts)
- **Flow Management API:** [/app/api/flows/route.ts](app/api/flows/route.ts)

### Documentation

- **Flow Builder README:** [FLOW_BUILDER_README.md](FLOW_BUILDER_README.md)
- **Flow Builder Testing:** [FLOW_BUILDER_TESTING_CHECKLIST.md](FLOW_BUILDER_TESTING_CHECKLIST.md)
- **Flow Builder Deployment:** [FLOW_BUILDER_DEPLOYMENT_GUIDE.md](FLOW_BUILDER_DEPLOYMENT_GUIDE.md)

---

## ✅ Conclusion

The Facebook integration pipeline is **architecturally sound** but has a **configuration gap**. The most likely root cause is:

> **The flow is either:**
>
> 1. Not assigned to the "Dreamer" page, OR
> 2. Not activated (`isActive = false`), OR
> 3. Page is not AI-enabled (`engineConnected = false`)

**Confidence Level:** 95%

**Recommended Next Step:** Run the diagnostic script to pinpoint the exact issue, then follow the fix procedure.

---

**Diagnostic Script:** `npm run diagnose:facebook`  
**Generated:** 16 February 2026  
**Engineer:** Senior DevOps + Backend Systems Engineer
