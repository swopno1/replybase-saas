# Facebook Message Testing Guide

## Current Status

✅ **What's Working:**

- Webhook verification (GET requests) - Meta can verify the webhook
- Webhook event logging - Verification events appear in admin dashboard
- Clear Logs button - Now deletes ALL logs from database

❌ **What's NOT Working:**

- Actual Facebook messages aren't reaching the webhook
- No POST events (messages, postbacks) are logged
- Flow is not executing

---

## Why Messages Aren't Working

When a user sends a message to your Facebook page, Meta should send a POST request to your webhook. The logs show **ONLY verification requests**, which means:

### Possible Causes:

1. **Webhook not subscribed to events** ⚠️ MOST LIKELY
   - Go to Meta App Dashboard → Webhooks
   - Check if subscribed to: `messages`, `messaging_postbacks`, `messaging_optins`

2. **Wrong webhook URL configured**
   - Should be: `https://app.replybase.co.uk/api/facebook/webhook`
   - Current in Meta App: **\_**?

3. **Page not connected to app**
   - Each Facebook Page must subscribe to your app
   - Meta App Dashboard → Messenger → Settings → Add/Remove Pages

4. **App in Development Mode**
   - Development mode = Only app admins can send messages
   - Solution: Submit for app review OR add testers
   - Meta App Dashboard → App Settings → Advanced → App Mode

---

## Step-by-Step Testing

### Test 1: Verify Webhook Configuration

1. Go to Meta App Dashboard: https://developers.facebook.com/apps/
2. Select your app
3. Go to **Webhooks** in sidebar
4. Find "Page" subscription
5. ✅ Verify URL: `https://app.replybase.co.uk/api/facebook/webhook`
6. ✅ Verify Token: `replybase_webhook_verify_2026_secure_token_fb`
7. ✅ Check subscribed fields:
   - [x] messages
   - [x] messaging_postbacks
   - [x] messaging_optins
   - [x] message_deliveries
   - [x] message_reads

**Expected Result:** All checkboxes should be ✅ green

---

### Test 2: Check Page Subscription

1. In Meta App Dashboard
2. Go to **Messenger** → **Settings**
3. Scroll to "Webhooks"
4. Find your "Dreamer" page
5. Click "Subscribe" to webhook events

**Expected Result:** Page appears in subscribed list

---

### Test 3: Send Test Event from Meta

1. In Meta App Dashboard → Webhooks
2. Find "Page" webhook
3. Click **Test** button next to "messages"
4. Click "Send to My Server"
5. Check production logs
6. Check `/admin/webhook-logs`

**Expected Result:**

- Server log: `[Facebook Webhook] Received verified event`
- Admin dashboard: New "message" event appears

---

### Test 4: Send Real Message

1. Go to Facebook/Messenger
2. Find "Dreamer" page
3. Send message: "Hello"
4. Check production logs immediately
5. Check `/admin/webhook-logs`

**Expected Result:**

- Server log: `[Facebook Webhook] Received verified event { object: 'page', entryCount: 1 }`
- Admin dashboard: New "message" event with your text
- FlowEngine log: `[FlowEngine] Executing flow for context`
- You receive a reply from the flow

---

### Test 5: Test GET_STARTED Button

1. Go to Messenger
2. Find "Dreamer" page
3. If you already messaged, delete conversation
4. Open fresh conversation
5. Click "Get Started" button
6. Check logs

**Expected Result:**

- Admin dashboard: "postback" event with payload "GET_STARTED"
- FlowEngine creates session
- You receive first flow message

---

## Debugging Commands

### Check if webhook events are reaching server:

```bash
# On Coolify, view live logs
# Look for: "[Facebook Webhook] Received verified event"
```

### Check database for flow sessions:

```sql
SELECT * FROM flow_sessions
WHERE "pageId" = (SELECT id FROM facebook_pages WHERE name ILIKE '%Dreamer%')
ORDER BY "createdAt" DESC
LIMIT 5;
```

### Check recent webhook logs:

```sql
SELECT
  type,
  source,
  event,
  data,
  "createdAt"
FROM webhook_logs
ORDER BY "createdAt" DESC
LIMIT 10;
```

### Check if flow is active:

```sql
SELECT
  f.id,
  f.name,
  f."isActive" as flow_active,
  fa."isActive" as assignment_active,
  fp.name as page_name
FROM flow_assignments fa
JOIN flows f ON fa."flowId" = f.id
JOIN facebook_pages fp ON fa."pageId" = fp.id
WHERE fp.name ILIKE '%Dreamer%';
```

---

## Quick Fix: Test with curl

Test if your webhook can receive POST events:

```bash
# Test message event
curl -X POST https://app.replybase.co.uk/api/facebook/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [{
      "id": "PAGE_ID",
      "time": 1645564800000,
      "messaging": [{
        "sender": {"id": "TEST_USER_123"},
        "recipient": {"id": "PAGE_ID"},
        "timestamp": 1645564800000,
        "message": {
          "mid": "mid.test123",
          "text": "Hello from curl test"
        }
      }]
    }]
  }'
```

**Expected:**

- Response: `{"success":true}`
- Admin dashboard: New webhook event logged
- (May not trigger flow because page/user don't exist, but event will be logged)

---

## Most Likely Solution

Based on the logs showing ONLY verification events, the issue is almost certainly:

**❌ Webhook is verified but NOT subscribed to message events**

### Fix:

1. Meta App Dashboard → Webhooks
2. Click "Add Subscription" under Page webhooks
3. Select:
   - ✅ messages
   - ✅ messaging_postbacks
   - ✅ messaging_optins
4. Click "Subscribe"
5. Under "Page Subscriptions", find "Dreamer" page
6. Click "Subscribe" button next to the page

Then send a test message - it should now appear in logs!

---

## Expected Logs When Working

When a user sends "Hello" to your page, you should see:

```
[Facebook Webhook] Received verified event { object: 'page', entryCount: 1 }
[FlowEngine] Executing flow for context: { userId: '123...', pageId: 'abc...', message: 'Hello' }
[FlowEngine] No active flow found for page: abc...
  OR
[FlowEngine] Created new session: sess_xyz123
[FlowEngine] Executing node node_abc123 of type message
[Facebook Send API] Success: message sent (mid.123456789)
```

---

## Contact for Help

If after following all steps messages still don't work:

1. Screenshot your Meta webhook configuration
2. Share the Dreamer page Facebook ID
3. Show the subscribed fields
4. Send me the exact error (if any) when clicking "Test" in Meta webhook dashboard
