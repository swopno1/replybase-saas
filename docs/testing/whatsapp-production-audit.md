# WhatsApp Integration Production Audit

## Overview
The WhatsApp integration in ReplyBase supports Meta Cloud API, Twilio, and 360dialog. It uses a webhook-driven architecture with an asynchronous worker for message processing.

## Architecture
1. **Webhook Layer** (`app/api/whatsapp/webhook/route.ts`):
   - Handles GET (Verification) and POST (Events).
   - Validates signatures for Meta and Twilio.
   - Normalizes payloads and pushes jobs to BullMQ (`message-processing` queue).
   - Uses `jobId` for database-level de-duplication.

2. **Worker Layer** (`lib/services/whatsapp-worker.ts`):
   - Processes jobs from BullMQ.
   - Handles Identity Stitching (`SYNC_XXX`).
   - Enforces Subscription Limits (Monthly Conversations & Automated Messages).
   - Manages CRM entities (Contact, Conversation, Message).
   - Executes Bot Entry Flows or falls back to AI (Vercel AI SDK).

3. **Provider Layer** (`lib/whatsapp-provider.ts`):
   - Abstraction for sending messages via different providers.
   - Normalizes phone numbers and addresses.
   - Handles credential validation.

## Security & Isolation
- **Multi-tenancy**: Every operation is scoped to a `tenantId`. The worker retrieves `tenantId` from the `Channel` -> `Bot` relation.
- **Credential Safety**: Credentials are encrypted at rest using `lib/channel-credentials-crypto.ts`.
- **Webhook Security**: Signatures are verified using App Secrets (Meta) or Auth Tokens (Twilio).

## Critical Reliability Features
- **Idempotency**: Webhook jobs use `jobId: whatsapp:${messageId}` in BullMQ.
- **Retry Logic**: BullMQ is configured with exponential backoff (3 attempts).
- **Rate Limiting**: Usage limits are checked before processing automated responses.
- **24h Window**: `lib/conversation-channel-delivery.ts` enforces the WhatsApp 24-hour customer service window.

## Identified Risks / Improvement Areas
- **Duplicate Webhooks**: While BullMQ handles `jobId` uniqueness, the `webhookLog` creation in the route is not strictly de-duplicated before the queue push, though `ensureContactAndConversation` uses `JobId`.
- **Media Handling**: Current implementation primarily focuses on `text`. Media (Images, PDF, Audio) handling is limited or missing in the worker.
- **Error Reporting**: Webhook processing errors are logged but not surfaced to the user in a detailed dashboard yet.
