# Telegram MVP Plan And Requirements

## 1. Objective

Build a production-ready Telegram channel integration as the immediate alternative to Meta-dependent onboarding, so customers can connect a Telegram bot and run ReplyBase chatbot flows with minimal setup.

Primary outcome:

- A tenant can connect Telegram in under 5 minutes.
- Incoming Telegram messages create or continue conversations in ReplyBase.
- Replies are sent back through Telegram Bot API.

## 2. Why Telegram Is A Strong MVP Alternative

- No app review bottleneck comparable to Meta verification for standard bot usage.
- Fast setup through `@BotFather` + webhook.
- Official Bot API is stable, HTTPS-based, and webhook-friendly.
- Works for private chats immediately, with optional group/channel features later.

## 3. MVP Scope

### 3.1 In Scope (Phase 1)

- Connect one Telegram bot per tenant (expand to multiple in Phase 2).
- Secure webhook receiver for Telegram updates.
- Text message receive + send.
- Basic button support (inline keyboard callbacks).
- Flow execution and AI fallback using existing ReplyBase conversation pipeline.
- Conversation logging and webhook diagnostics in admin panel.
- Basic command handling (`/start`, `/help`, `/settings`).
- Tenant-level enable/disable for Telegram channel.

### 3.2 Out Of Scope (Phase 1)

- Telegram Business rights-based operations.
- Payments in Stars.
- Mini App webview experience.
- Voice/file/media processing beyond metadata capture.
- Group moderation and complex admin-right flows.

## 4. Feature List For Telegram Channel

### 4.1 Customer-Facing Features

- Bot connection wizard:
  - Enter bot token.
  - Validate using `getMe`.
  - Auto-configure webhook via `setWebhook`.
  - Show connection health.
- Chatbot interaction:
  - Receive text messages from Telegram users.
  - Send generated replies.
  - Continue multi-turn conversation with session context.
- Commands:
  - `/start`: onboarding/welcome.
  - `/help`: quick usage and support.
  - `/settings`: link to account/preferences flow (or help text in MVP).
- Optional inline keyboard callbacks for quick replies.

### 4.2 Admin/Internal Features

- Webhook event logging (similar to existing Facebook monitoring).
- Replay-safe processing using `update_id` dedup.
- Webhook health check endpoint.
- Bot status indicator:
  - webhook configured or not,
  - last webhook event time,
  - last error message.

### 4.3 Data Features

- Map Telegram user and chat to existing contacts/leads.
- Persist Telegram message IDs for traceability.
- Store raw update payload for diagnostics (PII-safe retention policy).

## 5. Recommended Technical Design (Aligned With Current Codebase)

Current architecture references:

- `app/api/facebook/webhook/route.ts`
- `lib/facebook-sender.ts`
- `lib/flow-execution-engine.ts`

### 5.1 New Components

- `app/api/telegram/webhook/route.ts`
  - `POST` to receive Telegram updates.
  - Verify secret token header (`X-Telegram-Bot-Api-Secret-Token`) if configured.
  - Parse update types: `message`, `edited_message`, `callback_query` (MVP: mostly `message`, `callback_query`).
  - Respond fast with `200 OK`.
- `lib/telegram-sender.ts`
  - `sendMessage` wrapper with retry and error mapping.
  - Optional methods for `answerCallbackQuery`.
- `lib/telegram-utils.ts`
  - Update parsing helpers.
  - Dedupe helpers using `update_id`.
- `app/api/telegram/connect/route.ts`
  - Validate token (`getMe`).
  - Set webhook (`setWebhook`).
  - Store connection metadata.
- `app/api/telegram/disconnect/route.ts`
  - Remove webhook (`deleteWebhook`).
  - Disable channel.

### 5.2 Database Additions (Proposed)

- `TelegramBotConnection`
  - `id`
  - `tenantId`
  - `botTokenEncrypted`
  - `botUsername`
  - `botId`
  - `webhookUrl`
  - `webhookSecret`
  - `isActive`
  - `createdAt`, `updatedAt`
- `TelegramChatBinding`
  - `id`
  - `tenantId`
  - `telegramChatId` (string or bigint-safe)
  - `telegramUserId` (string or bigint-safe)
  - `contactId`
  - `leadId`
  - unique constraints on tenant + Telegram identifiers.
- `TelegramWebhookLog`
  - similar to existing webhook log strategy.
- `TelegramUpdateCursor` or processed update table
  - store last processed `update_id` per bot for dedupe.

### 5.3 Security Controls

- Encrypt bot tokens at rest.
- Never log full bot token.
- Use webhook secret token via `setWebhook(secret_token=...)`.
- Optionally IP allowlist Telegram webhook ranges:
  - `149.154.160.0/20`
  - `91.108.4.0/22`
- Validate tenant ownership on all Telegram management endpoints.

### 5.4 Message Flow

1. Telegram sends update to webhook.
2. Webhook validates request and deduplicates `update_id`.
3. Resolve tenant by bot connection.
4. Resolve/create contact mapping.
5. Pass message into existing conversation engine / flow engine.
6. Generate reply.
7. Send reply through `sendMessage`.
8. Persist logs and status.

## 6. Integration Documentation For Your Team And Customers

### 6.1 Customer Onboarding Steps (UI + docs)

1. Open Telegram and message `@BotFather`.
2. Run `/newbot`, choose bot name and username.
3. Copy the bot token.
4. In ReplyBase dashboard: Channels -> Telegram -> Connect.
5. Paste token and save.
6. ReplyBase validates token and sets webhook automatically.
7. User opens `https://t.me/<bot_username>` and clicks Start.
8. Conversation starts and appears in ReplyBase inbox/CRM.

### 6.2 Internal Setup Steps (Ops)

- Add environment variables:
  - `TELEGRAM_WEBHOOK_BASE_URL`
  - `TELEGRAM_WEBHOOK_SECRET`
  - `TELEGRAM_TOKEN_ENCRYPTION_KEY`
- Ensure public HTTPS endpoint is reachable on supported ports (443 preferred).
- Add observability alerts for webhook failures and sender API 429/5xx spikes.

### 6.3 Telegram API Methods Needed For MVP

- `getMe`
- `setWebhook`
- `getWebhookInfo`
- `deleteWebhook`
- `sendMessage`
- `answerCallbackQuery` (if callbacks are enabled)

### 6.4 Suggested API Contracts (ReplyBase Internal)

- `POST /api/telegram/connect`
  - Input: bot token
  - Output: bot profile, webhook status
- `POST /api/telegram/disconnect`
  - Output: success
- `GET /api/telegram/status`
  - Output: connection + webhook diagnostics
- `POST /api/telegram/webhook`
  - Input: Telegram Update
  - Output: `{ success: true }`

## 7. Telegram Requirements For A SaaS Developer (Must Follow)

Below is a condensed compliance and platform checklist from Telegram official docs.

### 7.1 Core Platform Requirements

- Bot token must remain confidential.
- Bot API calls must use HTTPS.
- Use either webhook or long polling, not both at the same time.
- Webhook endpoint requirements:
  - HTTPS with TLS 1.2+.
  - Supported ports: `443`, `80`, `88`, `8443`.
  - Valid cert chain (or upload self-signed cert when required).

### 7.2 Webhook Authenticity And Security

- Prefer `setWebhook(..., secret_token=...)` and verify header.
- Optional hardening with Telegram IP allowlist ranges.
- Return HTTP 2xx quickly to avoid retries.

### 7.3 Privacy Mode And Message Visibility

- In groups, privacy mode limits what bot receives unless disabled/admin.
- All private chat messages to the bot are received.
- Bot never receives messages from other bots.

### 7.4 Rate Limits And Broadcast

- Typical limits (official guidance):
  - about 1 msg/sec in a single chat,
  - about 20 msg/min in groups,
  - about 30 msg/sec bulk broadcast default.
- Handle `429` with retry-after backoff.

### 7.5 Digital Goods And Payments Rules

- If selling digital goods/services in Telegram, payment must use Stars (`XTR`).
- Bot should support payment dispute handling and `/paysupport` flow where applicable.
- For MVP chatbot channel, keep payments disabled unless explicitly needed.

### 7.6 Bot UX Requirements

- Telegram recommends supporting global commands:
  - `/start`
  - `/help`
  - `/settings` (if applicable)

### 7.7 Bot Developer Terms (Critical For SaaS)

- You are an independent third-party provider, not Telegram.
- Must provide accessible privacy policy for bot/mini app.
- Must delete user data when no longer needed and on valid request.
- Must not scrape or repurpose Telegram data beyond service necessity.
- Must secure data at rest and in transit.
- For Telegram Business integrations:
  - Use data only for chatbot service.
  - Do not disclose business chat data to third parties without authorization.
  - Be transparent with business owners about capabilities and changes.

## 8. Delivery Plan

### Phase 0 (1-2 days): Discovery And Design

- Finalize channel data model.
- Confirm tenant/channel limits in subscription plans.
- Create technical spec and migration plan.

### Phase 1 (3-5 days): Core Integration MVP

- Build connect/disconnect/status APIs.
- Build Telegram webhook endpoint.
- Add sender client and retries.
- Connect to existing conversation/flow engine.
- Add webhook logs.

### Phase 2 (2-4 days): Dashboard And Ops

- Add Telegram channel UI in dashboard.
- Add health indicators and diagnostics screen.
- Add admin troubleshooting actions.

### Phase 3 (2-3 days): Hardening And QA

- Security checks (token encryption, secret headers).
- Load and retry tests for webhook and sender.
- E2E tests with test bot.
- Production rollout checklist.

Estimated MVP total: 8-14 days.

## 9. QA And Acceptance Criteria

- Tenant can connect Telegram bot successfully.
- Webhook receives updates and maps them to correct tenant.
- Incoming message triggers reply within acceptable latency.
- Duplicate webhook updates do not create duplicate messages.
- System recovers from Telegram API transient errors.
- Logs provide enough data to debug failed updates.

## 10. Risks And Mitigation

- Risk: token leak.
  - Mitigation: encryption + masked logs + rotation support.
- Risk: webhook misconfiguration.
  - Mitigation: connection health checks + setup wizard validation.
- Risk: API throttling.
  - Mitigation: queued sends + exponential backoff + jitter.
- Risk: privacy/compliance drift.
  - Mitigation: documented retention policy + deletion workflows + privacy policy update.

## 11. Immediate Next Steps

1. Approve MVP scope in Section 3.
2. Approve data model in Section 5.2.
3. Create implementation tickets by phase.
4. Start Phase 1 with webhook + sender + connect APIs.

## 12. Official Reference Links

- Bot API: https://core.telegram.org/bots/api
- Bot FAQ: https://core.telegram.org/bots/faq
- Bot Features (privacy mode, commands, business): https://core.telegram.org/bots/features
- Webhook Guide: https://core.telegram.org/bots/webhooks
- Bot Developer Terms: https://telegram.org/tos/bot-developers
- Digital goods payments (Stars): https://core.telegram.org/bots/payments-stars
- Physical goods payments: https://core.telegram.org/bots/payments
