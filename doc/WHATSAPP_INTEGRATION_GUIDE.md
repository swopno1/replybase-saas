# WhatsApp Business Integration — Operator Guide

> **Version:** 2026-04-13  
> **Status:** Production-ready  
> **Scope:** ReplyBase SaaS (`replybase-saas`)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Environment Variables](#3-environment-variables)
4. [Provider Setup](#4-provider-setup)
   - 4.1 Meta Cloud API
   - 4.2 Twilio
   - 4.3 360dialog
5. [Webhook Endpoint](#5-webhook-endpoint)
6. [Message Flow](#6-message-flow)
7. [24-Hour Service Window](#7-24-hour-service-window)
8. [Security Model](#8-security-model)
9. [Credit Protection & Dedup](#9-credit-protection--dedup)
10. [Credential Storage](#10-credential-storage)
11. [Disconnect & Kill-Switch](#11-disconnect--kill-switch)
12. [Troubleshooting & Logs](#12-troubleshooting--logs)
13. [Production Checklist](#13-production-checklist)

---

## 1. Architecture Overview

```
Customer WhatsApp
        │
        ├─ Meta Cloud API (webhook POST → /api/whatsapp/webhook)
        ├─ Twilio         (webhook POST → /api/whatsapp/webhook)
        └─ 360dialog      (webhook POST → /api/whatsapp/webhook)
                │
                ▼
        Webhook Handler
        ┌────────────────────────────────────────────────┐
        │  1. Verify signature (HMAC-SHA256 / HMAC-SHA1) │
        │  2. Guard: payload.object = whatsapp_business_account │
        │  3. Atomic dedup via WebhookLog(source, event) │
        │  4. Upsert Contact + ContactIdentity           │
        │  5. Upsert CrmConversation                     │
        │  6. Persist inbound CrmMessage                 │
        │  7. Update conversation metadata (lastInboundAt) │
        │  8. sendAutoReply → Flow engine → AI fallback  │
        │  9. Persist outbound CrmMessage                │
        └────────────────────────────────────────────────┘
                │
        Manual agent replies (dashboard inbox)
        ┌────────────────────────────────────────────────┐
        │  POST /api/conversations/:id/messages          │
        │  → deliverConversationMessage()                │
        │  → 24-hour window check                        │
        │  → sendWhatsAppText()                          │
        └────────────────────────────────────────────────┘
```

**Key files:**

| File                                             | Purpose                                    |
| ------------------------------------------------ | ------------------------------------------ |
| `app/api/whatsapp/webhook/route.ts`              | Inbound handler, dedup, auto-reply         |
| `app/api/whatsapp/connect/route.ts`              | Connect a provider (POST)                  |
| `app/api/whatsapp/status/route.ts`               | Channel status (GET)                       |
| `app/api/whatsapp/disconnect/route.ts`           | Disconnect + kill-switch (POST)            |
| `app/api/whatsapp/logs/route.ts`                 | Recent webhook activity (GET)              |
| `lib/whatsapp-provider.ts`                       | Provider send / validate / signature logic |
| `lib/whatsapp-channel-credentials.ts`            | Credential envelope encrypt/decrypt        |
| `lib/channel-credentials-crypto.ts`              | AES-256-GCM primitive                      |
| `lib/conversation-channel-delivery.ts`           | Agent outbound delivery + window check     |
| `app/(dashboard)/integrations/whatsapp/page.tsx` | Dashboard UI                               |

---

## 2. Prerequisites

### For all providers

- A publicly reachable HTTPS URL for the webhook (no self-signed certs; Meta and Twilio require valid TLS).
- `WHATSAPP_WEBHOOK_BASE_URL` set to your app's public base URL (e.g. `https://app.replybase.com`).
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` set to a strong random string (≥ 32 characters).

### For Meta Cloud API

- An approved Meta Business App with the **WhatsApp Business Platform** product added.
- A registered **Phone Number** with `VERIFIED` status in the Meta Developer Console.
- A permanent **System User access token** with `whatsapp_business_messaging` permission.
- (Recommended) The **App Secret** to enable HMAC-SHA256 signature verification on every incoming webhook.

### For Twilio

- A Twilio account with the **WhatsApp Sandbox** or a production **Twilio WhatsApp sender** approved by Meta.
- The Twilio **Account SID**, **Auth Token**, and the WhatsApp-capable phone number (e.g. `+14155238886`).

### For 360dialog

- A 360dialog WABA partner account.
- Your **API Key** and **Channel ID** from the 360dialog Hub.

---

## 3. Environment Variables

Set these in your deployment environment (`.env` is not committed to VCS):

| Variable                             | Required    | Description                                                                                                                                                                |
| ------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN`      | **Yes**     | Token used for Meta webhook verification handshake. Also accepted as `FACEBOOK_WEBHOOK_VERIFY_TOKEN`.                                                                      |
| `WHATSAPP_WEBHOOK_BASE_URL`          | **Yes**     | Full public HTTPS base URL. Used to build the webhook URL returned to the operator. Falls back to request origin header if absent.                                         |
| `CHANNEL_CREDENTIALS_ENCRYPTION_KEY` | Recommended | 32-byte hex or UTF-8 key for AES-256-GCM encryption of stored credentials. Falls back to `AUTH_SECRET` (hashed with SHA-256) if absent. Set this explicitly in production. |
| `WHATSAPP_APP_SECRET`                | Recommended | Global Meta App Secret used as a fallback for HMAC-SHA256 signature verification when no per-channel app secret is stored. Also accepted as `FACEBOOK_CLIENT_SECRET`.      |

### Channel visibility flags

Channel visibility is controlled via `lib/channel-config.ts`. To enable WhatsApp in the UI and API, ensure:

```json
// via CHANNEL_CONFIG_OVERRIDES_JSON environment variable
{
  "whatsapp": { "enabled": true, "visibleInUi": true }
}
```

Or update `lib/channel-config.data.ts` to set the defaults.

---

## 4. Provider Setup

### 4.1 Meta Cloud API

1. **Create a Meta App** at [developers.facebook.com](https://developers.facebook.com) → Add product → WhatsApp Business Platform.
2. **Get credentials:**
   - `Phone Number ID` — from the WhatsApp → API Setup page.
   - `System User Access Token` — permanent token (not a temporary user token).
   - `App Secret` — from App Settings → Basic.
3. **Register the webhook in Meta:**
   - Webhook URL: `https://<your-domain>/api/whatsapp/webhook`
   - Verify Token: same value as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
   - Subscribe to: `messages` field.
4. **Connect in ReplyBase:**
   - Dashboard → Bot → Integrations → WhatsApp
   - Select provider: **Meta Cloud API**
   - Enter Access Token, Phone Number ID, (optional) Business Account ID, (recommended) App Secret

> **Note:** ReplyBase stores the App Secret encrypted alongside the access token. When an App Secret is present, every inbound webhook is HMAC-SHA256 verified before processing. Without it, signature verification is skipped — this is a security risk in production.

---

### 4.2 Twilio

1. **Set up a Twilio WhatsApp sender.**
   - Sandbox: twilio.com → Messaging → Try it out → WhatsApp (sandbox mode, for testing only).
   - Production: Request a WhatsApp-enabled Twilio number approved by Meta.
2. **Configure the Twilio incoming webhook:**
   - In Twilio Console → Messaging Services or Phone Numbers → WhatsApp Senders:
   - Set **Webhook URL** to: `https://<your-domain>/api/whatsapp/webhook`
   - Method: `HTTP POST`
3. **Connect in ReplyBase:**
   - Select provider: **Twilio**
   - Enter Account SID, Auth Token, Twilio From Number (e.g. `+14155238886`)

> **Security:** ReplyBase verifies the `X-Twilio-Signature` HMAC-SHA1 header on every Twilio webhook. The `authToken` is stored encrypted. Do not expose the Auth Token in URLs or logs.

---

### 4.3 360dialog

1. **Obtain API Key** from the [360dialog Hub](https://hub.360dialog.com).
2. **Register the webhook:**
   - Use the 360dialog Hub to set the Webhook URL to: `https://<your-domain>/api/whatsapp/webhook`
3. **Connect in ReplyBase:**
   - Select provider: **360dialog**
   - Enter API Key and Channel ID

> **Note:** 360dialog currently does not support HMAC signature verification on inbound webhooks. Traffic from 360dialog is authenticated only by the API key in outbound calls.

---

## 5. Webhook Endpoint

**URL:** `POST /api/whatsapp/webhook`  
**GET:** Meta verification handshake (`hub.mode=subscribe`)

The single endpoint handles all providers:

- **Meta:** JSON body, `Content-Type: application/json`, signature in `X-Hub-Signature-256`.
- **Twilio:** Form-encoded body, `Content-Type: application/x-www-form-urlencoded`, signature in `X-Twilio-Signature`.
- **360dialog:** JSON body (same format as Meta Cloud API).

The handler returns `200 OK` in all non-error cases (including "already processed") to prevent Meta/Twilio from retrying successfully delivered webhooks.

---

## 6. Message Flow

### Inbound (customer → ReplyBase)

```
1. Webhook arrives at POST /api/whatsapp/webhook
2. Signature verified (HMAC-SHA256 for Meta, HMAC-SHA1 for Twilio)
3. payload.object === "whatsapp_business_account" checked (Meta only)
4. Active channel looked up by metaPhoneNumberId / twilioFromNumber
5. Contact upserted by whatsapp_wa_id identity
6. CrmConversation upserted (contactId + botId + channel="whatsapp")
7. Dedup check: WebhookLog(source="whatsapp", event="meta_message:<id>")
   → If already exists: return 200, skip (prevents duplicate replies)
   → New: insert atomically; P2002 on race = skip
8. CrmMessage created (direction=inbound, source=human)
9. Conversation metadata updated (lastInboundAt = message timestamp)
10. sendAutoReply()
    a. Flow engine (channel-assigned flow → entry flow)
    b. AI fallback (converse())
    c. WhatsApp text sent via provider API
    d. CrmMessage created (direction=outbound, source=flow|ai)
    e. Milestone events recorded (first-channel, first-automated-reply)
11. 200 OK returned to provider
```

### Outbound — Manual Agent Reply (inbox)

```
POST /api/conversations/:id/messages
  → deliverConversationMessage()
     → 24-hour window check (lastInboundAt + 24h > now?)
       → Outside window → 409 { code: "outside_window" }
     → sendWhatsAppText()
       → Provider API call
     → CrmMessage created (direction=outbound, source=agent)
```

---

## 7. 24-Hour Service Window

WhatsApp's Business Policy requires that **free-form text replies** to customers are only sent within **24 hours** of the customer's last inbound message. After that window, only pre-approved **template messages** may be sent.

ReplyBase enforces this policy in two places:

| Location                               | Enforcement                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| `lib/conversation-channel-delivery.ts` | Manual agent replies from the inbox are blocked with a `409 outside_window` error.    |
| Auto-reply webhook                     | Auto-replies are always within the window (they fire immediately on inbound receipt). |

**How `lastInboundAt` is tracked:**  
Every inbound message updates `conversation.metadata.whatsapp.lastInboundAt` with the message's Unix timestamp from the provider.

**What to show the agent:**  
The `outside_window` error code is returned in the API response. The frontend should display a user-friendly message like: _"This conversation's 24-hour window has expired. You can only send template messages to reopen it."_

> Template message support (HSM) is not yet implemented. This is a known gap. Until templates are supported, operators must re-engage customers who message first.

---

## 8. Security Model

### Signature Verification

| Provider       | Header                | Algorithm   | Key                                                         |
| -------------- | --------------------- | ----------- | ----------------------------------------------------------- |
| Meta Cloud API | `X-Hub-Signature-256` | HMAC-SHA256 | App Secret (per-channel, fallback to `WHATSAPP_APP_SECRET`) |
| Twilio         | `X-Twilio-Signature`  | HMAC-SHA1   | Auth Token (per-channel)                                    |
| 360dialog      | —                     | None        | Auth via outbound API Key only                              |

All signature comparisons use `crypto.timingSafeEqual` to prevent timing attacks.

### Credential Storage

All credentials (access tokens, auth tokens, API keys) are:

1. Wrapped in a JSON **envelope** containing provider type and timestamp.
2. Encrypted with **AES-256-GCM** using the key derived from `CHANNEL_CREDENTIALS_ENCRYPTION_KEY` or `AUTH_SECRET`.
3. Stored in the `Channel.accessToken` column as a `iv:authTag:ciphertext` base64 string.

Credentials are never returned in plaintext via any API. The `status` endpoint returns **masked** values only (first 4 and last 4 characters shown).

### Multi-Tenant Isolation

- All webhook processing looks up channels only for `isActive=true, enabled=true, killSwitch=false`.
- All API endpoints (`connect`, `status`, `disconnect`, `logs`) verify the calling user's `tenantId` matches the bot's `tenantId` before returning or modifying data.
- The webhook endpoint has no authentication (public endpoint required by providers) — isolation is achieved via per-channel signature verification and channel lookup.

---

## 9. Credit Protection & Dedup

Credits are consumed when `sendWhatsAppText()` is called. The following guards prevent unnecessary sends:

### Guard 1 — Dedup by Message ID

Every processed inbound message writes a `WebhookLog` entry with a globally unique `event` key:

- Meta: `meta_message:<wamid>` (e.g. `meta_message:wamid.HBgL...`)
- Twilio: uses `MessageSid` (passed as `messageId`)

The creation is **atomic**: if two concurrent requests race on the same message ID, only one will succeed inserting the `WebhookLog` row (a Postgres unique index on `(source, event)` enforces this). The losing request catches the `P2002` Prisma unique-constraint error and returns early without sending any message.

### Guard 2 — Only Process `type=text` Messages

Non-text messages (images, audio, location, reaction, etc.) are silently skipped. No reply is generated.

### Guard 3 — Only Process `messages` Field Changes (Meta)

The `payload.object === "whatsapp_business_account"` guard ensures unrelated Meta webhook types (Messenger, Instagram) never trigger processing.

### Guard 4 — Only Reply If AI/Flow Returns Text

`sendAutoReply` only calls `sendWhatsAppText` if `replyText` is non-null after both the flow engine and AI fallback have been tried. If both return nothing (e.g., bot has no configuration), no message is sent.

### Guard 5 — 24-Hour Window (Manual Replies)

Manual agent replies that fall outside the window are blocked before any API call is made.

### Guard 6 — Kill-Switch

Any channel can be immediately disabled by:

- Calling `POST /api/whatsapp/disconnect`, which sets `killSwitch=true, isActive=false, enabled=false, accessToken=null`.
- Setting `ENABLE_CHANNEL_WHATSAPP=false` in the environment, which blocks the entire `/api/whatsapp/*` surface.

### Guard 7 — Message Length Cap

Outbound messages are truncated to **4096 characters** (WhatsApp's limit) before sending. A `delivery_warning` `WebhookLog` entry is written if truncation occurs.

---

## 10. Credential Storage

```
Plain credentials (JSON object)
  └─ encryptWhatsAppCredentialEnvelope()
       └─ JSON.stringify({ provider, credentials, updatedAt })
            └─ encryptChannelCredentialPayload()  [AES-256-GCM]
                 └─ "iv:authTag:ciphertext"  →  stored in Channel.accessToken
```

**Key derivation:**  
`SHA-256(CHANNEL_CREDENTIALS_ENCRYPTION_KEY || AUTH_SECRET)` → 32-byte AES key

**Why not use a separate secrets manager?**  
AES-256-GCM is sufficient for at-rest protection if the key (env var) is stored in a secrets manager (e.g., AWS Secrets Manager, Vercel env vars with encryption at rest). The encryption key must NOT be stored in the same database as the ciphertext.

---

## 11. Disconnect & Kill-Switch

### Graceful disconnect

`POST /api/whatsapp/disconnect { channelId }`

- Sets `isActive=false, enabled=false, killSwitch=true, accessToken=null`
- Stamps `disconnectedAt` in channel `config`
- The channel record is retained for audit history; reconnect creates a new `accessToken`

### Emergency kill-switch

Set the environment variable:

```
ENABLE_CHANNEL_WHATSAPP=false
```

This causes `isChannelEnabled("whatsapp")` to return `false`, which:

- Returns 403 on all `/api/whatsapp/*` routes
- Hides the channel from all UIs
- Prevents any webhook processing

Alternatively, use the `killSwitch=true` flag on individual channels (already set by disconnect) — the `getActiveWhatsAppChannels()` query filters `killSwitch: false`.

---

## 12. Troubleshooting & Logs

### Recent Activity UI

Each bot's WhatsApp integration page shows **Recent Webhook Activity** (last 15 events). This calls `GET /api/whatsapp/logs?channelId=<id>&limit=15`.

### Log Events Reference

| Event key pattern              | Type               | Meaning                                                       |
| ------------------------------ | ------------------ | ------------------------------------------------------------- |
| `meta_message:<wamid>`         | `message`          | Inbound text message processed                                |
| `meta_status:<wamid>:<status>` | `delivery`         | Outbound message delivery status (sent/delivered/read/failed) |
| `twilio_status:<sid>:<status>` | `delivery`         | Twilio outbound status callback                               |
| `send_error:<channelId>`       | `delivery_error`   | Failed to send auto-reply                                     |
| `reply_truncated:<channelId>`  | `delivery_warning` | Reply exceeded 4096 chars and was truncated                   |

### Common Issues

**"Missing signature" (403)**  
The `WHATSAPP_APP_SECRET` is configured but Meta is not sending `X-Hub-Signature-256`. Check that the App Secret is correct in the Meta developer console and that `hub.verifyToken` in the subscription matches `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.

**"Invalid signature" (403)**  
The app secret stored in the channel credentials or the `WHATSAPP_APP_SECRET` env var does not match what Meta is signing with. Reconnect the channel with the correct App Secret.

**No auto-reply sent, no error in logs**  
The flow engine and AI fallback both returned no text. Check:

1. Is the bot properly configured with an AI engine?
2. Is there a flow assigned to the WhatsApp channel?
3. Is the AI engine's knowledge base / prompt populated?

**Duplicate inbound messages in CRM**  
Should not occur after the `P2002` dedup fix. If seen, check whether the unique index `webhook_logs_source_event_key` was applied (`prisma migrate deploy` run after upgrade).

**"Channel limit reached" on connect**  
The tenant's subscription plan limits the number of channels per bot. Upgrade the plan or remove an unused channel.

---

## 13. Production Checklist

Before deploying to production:

- [ ] `WHATSAPP_WEBHOOK_VERIFY_TOKEN` is set (≥ 32 random characters)
- [ ] `WHATSAPP_WEBHOOK_BASE_URL` is set to the live HTTPS domain
- [ ] `CHANNEL_CREDENTIALS_ENCRYPTION_KEY` is set explicitly (not relying on `AUTH_SECRET` fallback)
- [ ] Meta webhook is registered and subscribed to the `messages` field
- [ ] App Secret is stored in the channel credentials (not just `WHATSAPP_APP_SECRET` env fallback)
- [ ] `prisma migrate deploy` has been run — includes `webhook_logs_source_event_key` unique index
- [ ] `ENABLE_CHANNEL_WHATSAPP=true` (or via `CHANNEL_CONFIG_OVERRIDES_JSON`)
- [ ] `ENABLE_UI_CHANNEL_WHATSAPP=true` (or via `CHANNEL_CONFIG_OVERRIDES_JSON`)
- [ ] A test message has been sent and received end-to-end
- [ ] Webhook logs show `meta_message:*` entries for the test message (no duplicates)
- [ ] Disconnect button tested — confirm subsequent webhooks return `matched: false`
- [ ] Kill-switch tested — confirm `ENABLE_CHANNEL_WHATSAPP=false` blocks all processing

---

## Appendix — Known Limitations (not yet implemented)

| Feature                               | Status          | Notes                                                                                               |
| ------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| Template messages (HSM)               | Not implemented | Required for outbound messages outside the 24-hour window                                           |
| Rich media (images, documents)        | Not implemented | Only text messages are processed and replied to                                                     |
| Interactive messages (buttons, lists) | Not implemented | Inbound interactive messages are silently dropped                                                   |
| Webhook re-registration               | Not implemented | Unlike Telegram, there is no `/api/whatsapp/reconnect` endpoint; reconnect by calling connect again |
| Per-channel rate limiting             | Not implemented | Consider adding a Redis-based rate limiter to cap sends per number per minute                       |
| 360dialog inbound webhook signature   | Not implemented | 360dialog does not natively support HMAC signing                                                    |
