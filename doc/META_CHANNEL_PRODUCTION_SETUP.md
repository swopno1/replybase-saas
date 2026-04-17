# Meta Channel Production Setup (Facebook + WhatsApp)

Use this checklist to configure Meta Dashboard and ReplyBase for production chat operations.

## 1. Required Environment Variables

Set these in production deployment:

```env
ENABLE_CHANNEL_FACEBOOK=true
ENABLE_UI_CHANNEL_FACEBOOK=true
ENABLE_CHANNEL_WHATSAPP=true
ENABLE_UI_CHANNEL_WHATSAPP=true

FACEBOOK_CLIENT_ID=...
FACEBOOK_CLIENT_SECRET=...
FACEBOOK_WEBHOOK_VERIFY_TOKEN=...

WHATSAPP_APP_SECRET=...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=...
# optional override
# WHATSAPP_WEBHOOK_BASE_URL=https://app.replybase.co.uk
```

## 2. Facebook App Configuration (Meta)

Meta App Dashboard settings:

1. Add product `Facebook Login`.
2. Add valid OAuth redirect URI:
   - `https://app.replybase.co.uk/api/auth/callback/facebook`
3. Add product `Webhooks` and subscribe to Facebook Page events.
4. Callback URL:
   - `https://app.replybase.co.uk/api/facebook/webhook`
5. Verify token:
   - Value from `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
6. Ensure app has these permissions approved:
   - `pages_show_list`
   - `pages_manage_metadata`
   - `pages_messaging`

## 3. WhatsApp Cloud API Configuration (Meta)

Meta App Dashboard settings:

1. Add product `WhatsApp`.
2. Callback URL:
   - `https://app.replybase.co.uk/api/whatsapp/webhook`
3. Verify token:
   - Value from `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
4. Ensure app has these permissions approved:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
5. In WhatsApp Manager, identify:
   - Permanent Access Token
   - Phone Number ID
   - Business Account ID (optional but recommended)

## 4. ReplyBase Dashboard Setup

1. Go to `Integrations -> Facebook`.
2. Connect with Facebook and select pages.
3. Go to `Integrations -> WhatsApp`.
4. Select bot and provide:
   - Permanent access token
   - Phone Number ID
   - Business Account ID (optional)
5. Save connection and verify webhook status changes to active.

## 5. Flow + Lead Capture Setup

1. Create or activate a lead capture flow in `Flows`.
2. Assign flow to channel in:
   - `Flows -> Settings -> Channel Assignment`
3. Confirm bot entry flow is active for fallback handling.

## 6. Runtime Verification

1. Open `Integrations -> Facebook` and verify setup badges are green.
2. Open `Integrations -> WhatsApp` and verify:
   - connected status
   - webhook URL
   - token configured
   - inbound/outbound timestamps updating
3. Send test inbound messages from both channels.
4. Confirm in `Conversations`:
   - contact created
   - conversation created
   - inbound message saved
   - flow/AI outbound response saved

## 7. Agent Reply Verification

Reply from CRM conversation thread and confirm external delivery to:

- Facebook Messenger recipient
- WhatsApp recipient

Manual outbound delivery is now wired for:

- facebook
- telegram
- whatsapp

## 8. Security Notes

- Use permanent tokens in production, not temporary test tokens.
- Rotate Meta app secrets periodically.
- Keep all secrets server-side only.
- Never expose app secret or access tokens in browser code.
