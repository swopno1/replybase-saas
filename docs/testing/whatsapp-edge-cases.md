# WhatsApp Edge Cases & Test Results

## 1. Duplicate Webhooks
- **Scenario**: Provider sends the same messageId twice in quick succession.
- **Handling**: BullMQ `jobId` is set to `whatsapp:${messageId}`.
- **Test Result**: Verified that BullMQ rejects duplicate `jobId`, preventing double-processing and double-billing.

## 2. Invalid Signatures
- **Scenario**: Attacker attempts to spoof a Meta or Twilio webhook.
- **Handling**: Signature verification (SHA256 for Meta, HMAC-SHA1 for Twilio) is enforced.
- **Test Result**: Verified that the Webhook API returns 403 Forbidden for mismatched signatures.

## 3. Subscription Exhaustion
- **Scenario**: User reaches their monthly conversation limit or automated message limit.
- **Handling**: `checkTenantUsageLimits` is called at the start and middle of the worker process.
- **Test Result**: Verified that the worker stops processing and does not send automated replies if limits are reached.

## 4. 24-Hour Window Expiry
- **Scenario**: Human agent tries to reply to a contact after 24 hours of inactivity.
- **Handling**: `deliverConversationMessage` checks `lastInboundAt` from metadata.
- **Test Result**: Verified that the system returns `outside_window` error code.

## 5. Media Messages
- **Scenario**: User sends an image or audio file.
- **Handling**: The current worker filters for `type: "text"`.
- **Test Result**: Verified that non-text messages are ignored to prevent processing errors, though they are still logged in the raw webhook logs.

## 6. Multi-Tenant Leakage
- **Scenario**: Webhook for Tenant A triggers processing that accidentally uses Tenant B's credentials.
- **Handling**: Webhook route lookups are scoped by `phoneNumberId` or `To` number, which are unique per bot/channel.
- **Test Result**: Verified that the worker uses the `tenantId` from the specific channel matching the inbound ID.
