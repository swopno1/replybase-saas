# 🎯 Bot vs Flow Architecture - Complete Guide

## 1. Critical Finding: Your Flow IS Your Bot Right Now

The diagnostic revealed a fundamental architectural difference you need to understand:

### **Flow** (What You Have Working)

- **Purpose**: Sequential conversation builder (like a decision tree)
- **Storage**: Database tables (`flows`, `flow_nodes`, `flow_assignments`)
- **Execution**: Internal TypeScript engine (`FlowExecutionEngine`) in your SaaS
- **When User Clicks "Get Started"**:
  1. ✅ Webhook receives postback
  2. ✅ FlowExecutionEngine executes first node
  3. ✅ Sends: "Welcome! How can I help you?" + [Start] button
  4. ✅ User clicks [Start] → Executes next node

### **Bot** (What's Partially Broken)

- **Purpose**: AI-powered conversation handler + external builder interface
- **Storage**: Database table (`bots`)
- **Execution**:
  - Internal: For default conversation flows
  - External: Can integrate with Typebot Engine (engine.replybase.co.uk)
- **Use Case**: More complex AI responses, custom logic beyond sequential flows

---

## 2. Current Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Clicks "Get Started"                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│     Facebook Webhook (/api/facebook/webhook)                    │
│  Receives: POST { entry[0].messaging[0].postback }              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ Check if "Hi" or   │
                    │ "Get Started"      │
                    │ Convert to "Hi"    │
                    └────────────┬───────┘
                                 │
                    ┌────────────▼────────────┐
                    │ ✅ Flow Execution       │
                    │ (NEW - Fixed!)          │
                    │ Look for active flow    │
                    │ assignment for page     │
                    └────────────┬────────────┘
                                 │
                ┌────────────────▼────────────────┐
                │   FLOW FOUND?                   │
                └────┬──────────────────────┬─────┘
         YES ◄───────┘                      │
             │                              │ NO
             │                              │
    ┌────────▼─────────────┐    ┌──────────▼──────────────┐
    │ Execute Flow Nodes   │    │ Check AI Engine Status  │
    │ Send first message   │    │ (engineConnected=true?) │
    │ Create FlowSession   │    └──────────┬───────────────┘
    └──────────────────────┘               │
                                    ┌──────▼──────────┐
                                    │ AI ENABLED?     │
                                    └────┬───────┬────┘
                          YES ◄──────────┘       │ NO
                             │                   │
                    Send AI response        Fall back to
                    (or Typebot flow)       default flow
```

---

## 3. Your Actual Setup

### What's Working ✅

- Flow Builder system (independent)
- Flow creation, assignment, activation
- Facebook webhook integration
- FlowExecutionEngine

### What's Broken ❌

- Bot creation form doesn't actually POST to API
- Typebot Authorization endpoint has OIDC errors
- Bot list not showing created bots
- "Launch Builder" throws: `error: server_error`

---

## 4. Why Bot Creation Failed

### Issue 1: Bot Creation Form Doesn't Submit

**File**: [/app/(dashboard)/bots/new/page.tsx](<app/(dashboard)/bots/new/page.tsx#L23-L30>)
**Problem**: Form just redirects without posting data

```typescript
// BEFORE (broken)
const handleSubmit = async (e: React.FormEvent) => {
  router.push("/bots"); // ❌ Just redirects, no API call
};
```

**Fixed**: Now actually posts to `/api/bots` ✅

### Issue 2: OIDC `server_error`

**Error Message**:

```
error: server_error
error_description: oops! something went wrong
state: cmlp5r20z000113t18hxzga2m
iss: https://app.replybase.co.uk/api/oidc
```

**Likely Causes** (in order of probability):

1. User has no active subscription
2. `getOidcProvider()` initialization failing silently
3. OIDC_JWKS malformed
4. Database connection issue fetching user/tenant data

---

## 5. How to Verify It's Working Now

### Step 1: Create a Bot

```bash
curl -X POST https://app.replybase.co.uk/api/bots \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "My Test Bot",
    "channel": "facebook"
  }'
```

### Step 2: Check Bot List

Visit: https://app.replybase.co.uk/bots

You should see the bot listed

### Step 3: Test Webhook

Send a "Get Started" postback from Facebook:

```json
{
  "sender": { "id": "USER_PSID" },
  "recipient": { "id": "PAGE_ID" },
  "postback": { "payload": "GET_STARTED" }
}
```

Expected response in conversation:

> "Welcome! How can I help you?" + [Start] button

---

## 6. Bot vs Flow - Decision Tree

**When should I use Flow vs Bot?**

```
┌─────────────────────────────────────────────────────┐
│  Do you want a visual, multi-step conversation?    │
│  (with buttons, conditional logic, forms, etc)     │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────▼─────────────┐
        │  YES - Use FLOW ✅       │
        │                          │
        │ • Go to /flows           │
        │ • Create new flow        │
        │ • Add nodes visually     │
        │ • Assign to page         │
        │ • Activate               │
        └──────────────────────────┘

        ┌────────────▼──────────────────┐
        │  NO - Need AI responses?      │
        └────────┬──────────────────┬───┘
                 │                  │
          ┌──────▼──────┐  ┌────────▼─────────┐
          │YES - Use BOT │  │NO - Use Default │
          │              │  │    Bot Flow     │
          │Needs:        │  │                 │
          │ • Subscription   (Fall back)    │
          │ • Typebot eng    │                 │
          └──────────────┘  └─────────────────┘
```

---

## 7. Next Steps (What To Do Now)

### Immediate: Create a Bot (Test)

1. Go to `/bots` in your dashboard
2. Click "New Bot" button
3. Enter bot name: "Test Bot"
4. Select channel: "Facebook"
5. Click "Create Bot"
6. Bot should appear in list

### If OIDC Error Occurs

Check these in order:

1. **Subscription Status**: User must have active subscription

   ```sql
   SELECT s.status FROM subscriptions s
   WHERE s."tenantId" = 'YOUR_TENANT_ID';
   ```

2. **Database Connection**:

   ```bash
   npm run db:cleanup  # Tests connection
   ```

3. **OIDC Configuration**:
   - Check `.env`: All TYPEBOT\_\* vars set?
   - Check `.env`: OIDC_JWKS valid JSON?

---

## 8. Timeline: Flow vs Bot Implementation

### ✅ Completed (Week 1-2)

- Flow Builder system (full)
- Facebook webhook integration
- FlowExecutionEngine

### 🔧 In Progress (Current)

- Bot creation form fix ← **You are here**
- OIDC authorization debugging
- Typebot registration process

### 📋 Todo (Week 3-4)

- Typebot Engine integration
- AI response routing
- Advanced bot features

---

## 9. Troubleshooting Checklist

### Bot Creation Issues

| Issue                       | Check                          | Fix                                           |
| --------------------------- | ------------------------------ | --------------------------------------------- |
| Form doesn't submit         | Browser console errors         | Clear cache, refresh page                     |
| Bot created but not in list | Multiple Discord subscriptions | Check `subscriptions` table for user's tenant |
| "Launch Builder" OIDC error | User subscription active?      | Go to `/pricing`, select plan, apply          |
| OIDC token invalid          | JWKS environment var           | Regenerate: `node scripts/generate-jwks.js`   |

### Flow Execution Issues

| Issue               | Check                  | Fix                                          |
| ------------------- | ---------------------- | -------------------------------------------- |
| Flow not triggering | Flow assignment active | Go to `/flows`, click flow, check assignment |
| Wrong message sent  | Flow node content      | Edit flow, verify first node text            |
| User sees nothing   | engineConnected flag   | This should no longer block flows (fixed!)   |

---

## 10. Architecture Summary Diagram

```
┌──────────────────────────────────────────────────────────┐
│                        ReplyBase SaaS                    │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │            Flow Builder (✅ Working)               │ │
│  │  /flows → Create, Edit, Assign, Execute          │ │
│  │  Execution: /lib/flow-execution-engine.ts         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │            Bot Management (🔧 Fixing)             │ │
│  │  /bots → Create, Configure, Launch Builder       │ │
│  │  OIDC: /api/typebot/authorize                     │ │
│  │  OIDC Provider: /api/oidc/[...oidc]               │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │         Facebook Webhook (✅ Working)              │ │
│  │  /api/facebook/webhook                             │ │
│  │  Handles: messages, postbacks, events              │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
           │                             │
           │                             │
           ▼                             ▼
     ┌──────────────┐           ┌──────────────────┐
     │   Facebook   │           │  Typebot Engine  │
     │   Messenger  │           │  (Optional later) │
     │   (POST)     │           │  OIDC OAuth      │
     └──────────────┘           └──────────────────┘
```

---

## 11. Key Takeaway

**Your Flow system works independently of Bots.**

- Clicking "Get Started" triggers Flow immediately ✅
- Bot is optional for AI features and external builder
- You can use Flows without ever creating a Bot
- Bot creation enables Typebot integration later

**The fix I applied**: Moved Flow execution BEFORE AI engine check, so flows work regardless of bot/AI status.

---

**Need help?** Check the specific troubleshooting section above for your issue.
