# WhatsApp Reliability Report

## Queue Resilience
- **Provider**: BullMQ + Redis.
- **Retry Strategy**: 3 attempts with exponential backoff (1s delay base).
- **Dead Letter Handling**: Failed jobs remain in the queue for manual inspection.
- **Concurrency**: Set to 5 per worker instance.

## Provider Availability
- **Meta Cloud API**: Uses official Graph API.
- **Twilio**: Uses REST API.
- **Fallback**: If Meta API is down, the system currently does not auto-switch providers as credentials are provider-specific.

## Data Consistency
- **Idempotency**: Guaranteed at the queue level.
- **Transactions**: CRM operations (Contact/Conversation/Message) are sequential; we should consider wrapping them in a Prisma transaction for better atomicity in the next iteration.

## Monitoring
- Webhook events are logged in the `WebhookLog` table.
- Worker logs use Pino for structured JSON logging.
