# WhatsApp Integration Edge Cases & Handling

This document lists critical edge cases identified during the production audit and how they are handled by ReplyBase.

## 1. Webhook Concurrency & Duplication
- **Scenario**: Meta sends the same message multiple times due to a timeout or network glitch.
- **Handling**: ReplyBase uses `jobId: "whatsapp:${messageId}"` in BullMQ. Redis prevents multiple jobs with the same ID from being queued, ensuring a single message is processed only once.

## 2. 24-Hour Service Window
- **Scenario**: An agent or AI attempts to reply to a user more than 24 hours after their last inbound message.
- **Handling**: `lib/conversation-channel-delivery.ts` checks the `lastInboundAt` timestamp in conversation metadata. If exceeded, the message is blocked with a `outside_window` error code to avoid Meta API errors.

## 3. Quota Hard-Block
- **Scenario**: A tenant reaches 100% of their monthly message limit.
- **Handling**:
    - **100% - 110%**: GRACE period. Messages are delivered but a warning is logged.
    - **> 110%**: HARD block. Automated replies are skipped, and inbound messages are not stored to prevent storage bloat and overage costs.

## 4. DB Connection Failures during Webhook
- **Scenario**: The database is slow or temporarily unreachable when a webhook arrives.
- **Handling**: The `POST` handler in `/api/whatsapp/webhook` uses `.catch()` on logging operations. The critical path (adding to BullMQ) is prioritized. If Redis is also down, the webhook returns a 500, prompting the provider to retry later.

## 5. Multi-Language / Emoji
- **Scenario**: Inbound messages containing non-Latin scripts or heavy emoji usage.
- **Handling**: All string handling is UTF-8 compliant. AI fallback and Flow engines are tested to handle multi-language inputs correctly.

## 6. Identity Stitching (`SYNC_`)
- **Scenario**: A user clicks a "Sync with WhatsApp" button on the website.
- **Handling**: The inbound message starts with `SYNC_`. The system stitches the website session with the WhatsApp identity, allowing for seamless context preservation across channels.
