# Webhook Monitoring System - Setup Guide

## ✅ What Was Added

A real-time webhook event monitoring dashboard to help you verify Facebook message delivery.

### Files Created

1. **Admin Dashboard Page**
   - Location: `/app/(dashboard)/admin/webhook-logs/page.tsx`
   - URL: `https://app.replybase.co.uk/admin/webhook-logs`
   - Features:
     - Real-time event display (auto-refresh every 3 seconds)
     - Event type badges (message, postback, delivery, read)
     - JSON payload viewer
     - Clear logs button

2. **API Endpoint**
   - Location: `/app/api/admin/webhook-logs/route.ts`
   - GET: Fetches last 50 webhook events
   - DELETE: Clears logs older than 1 hour

3. **Database Model**
   - Location: `prisma/schema.prisma`
   - Model: `WebhookLog`
   - Fields: id, type, source, event, data (JSON), createdAt

4. **Webhook Handler Updates**
   - Location: `/app/api/facebook/webhook/route.ts`
   - Added: Event logging for messages, postbacks, delivery, read events
   - Added: Console logs for verification requests

5. **Middleware Update**
   - Location: `middleware.ts`
   - Added: Facebook webhook bypass for auth check
   - **Critical Fix**: This was blocking webhook verification!

---

## 🚀 Setup Steps

### Step 1: Run Database Migration

```bash
npx prisma migrate dev --name add_webhook_logs
```

This creates the `webhook_logs` table in your database.

### Step 2: Regenerate Prisma Client

```bash
npx prisma generate
```

This makes `prisma.webhookLog` available in your code.

### Step 3: Deploy/Restart Server

```bash
# If local development
npm run dev

# If production
# Deploy the changes and restart
```

### Step 4: Verify Facebook Webhook

1. Go to Meta Developer Console → Your App → Webhooks
2. Under "Page" product, click **Verify and Save**
3. You should see success (middleware fix allows this now)

### Step 5: Test & Monitor

1. Navigate to: `https://app.replybase.co.uk/admin/webhook-logs`
2. Send a message to your Facebook page "Dreamer"
3. Click "Get Started" button
4. Watch events appear in real-time!

---

## 📊 What You'll See

### Event Types

| Type         | Trigger                          | Data Logged                  |
| ------------ | -------------------------------- | ---------------------------- |
| **message**  | User sends text                  | Sender ID, text, attachments |
| **postback** | User clicks button (Get Started) | Sender ID, payload, title    |
| **delivery** | Message delivered                | Delivery confirmation        |
| **read**     | User reads message               | Read receipt                 |

### Example Log Entry

```json
{
  "id": "clxyz123...",
  "type": "postback",
  "source": "facebook",
  "event": "page",
  "data": {
    "sender": "7234567890",
    "payload": "GET_STARTED",
    "title": null
  },
  "createdAt": "2026-02-17T10:30:00.000Z"
}
```

---

## 🔧 Troubleshooting

### No Events Showing

**Check 1: Webhook Verification**

```bash
curl -i "https://app.replybase.co.uk/api/facebook/webhook?hub.mode=subscribe&hub.verify_token=replybase_webhook_verify_2026_secure_token_fb&hub.challenge=test123"
```

Expected: `test123` with HTTP 200

**Check 2: Database Migration**

```bash
# Verify table exists
npx prisma studio
# Check if webhook_logs table appears
```

**Check 3: Meta Webhook Config**

- Callback URL: `https://app.replybase.co.uk/api/facebook/webhook`
- Verify Token: `replybase_webhook_verify_2026_secure_token_fb`
- Subscribed fields: `messages`, `messaging_postbacks`, `messaging_optins`

### Events Logged But Flow Not Executing

This means:

1. ✅ Facebook IS delivering events
2. ❌ Flow execution is failing

Check the diagnostic:

```bash
npm run diagnose:facebook
```

Look for warnings about flow assignment or activation.

---

## 🎯 What This Tells You

### Scenario A: Events Appearing

**Status**: ✅ Webhook delivery working  
**Next**: Check why flow isn't executing (assignment/activation)

### Scenario B: No Events

**Status**: ❌ Webhook delivery blocked  
**Next**: Fix Meta webhook configuration or verify token

### Scenario C: Only Verification Events

**Status**: ⚠️ Webhook verified but subscriptions missing  
**Next**: Add page subscriptions in Meta dashboard

---

## 🔐 Security Note

The webhook logs page is protected by:

1. NextAuth session requirement
2. `/admin` route (consider adding role check later)

**Temporary Access**: Any logged-in user can view logs  
**Production**: Add role-based access control

---

## 🧹 Auto-Cleanup

Logs older than 1 hour are automatically deleted when you click "Clear Logs"

To change retention:

```typescript
// In /app/api/admin/webhook-logs/route.ts
lt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour
// Change to:
lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours
```

---

## ✅ Success Criteria

After setup, you should see:

1. **Webhook Verification Success** in Meta Dashboard
2. **Events appearing** in `/admin/webhook-logs` when you message the page
3. **Flow sessions created** (`npm run diagnose:facebook` shows `recent_sessions > 0`)
4. **Automated responses** delivered to Messenger

---

## 📝 Next Steps

Once webhook delivery is confirmed:

1. **Test Flow Execution**: Send "Get Started" → should create flow session
2. **Check Message Delivery**: User should receive "Welcome! How can I help you?"
3. **Monitor CRM Messages**: Check `crm_messages` table for logged conversations
4. **Production Deploy**: Push changes to production environment

---

**Created**: 17 February 2026  
**Status**: Ready for testing  
**Dependencies**: Requires database migration
