# WhatsApp Provider Test Matrix

| Feature | Meta Cloud API | Twilio WhatsApp | 360dialog (v2) |
|---------|----------------|-----------------|----------------|
| **Connection Validation** | Tested (GET /me) | Tested (GET /Account) | Tested (GET /contacts) |
| **Inbound Text** | Supported | Supported | Supported (via Meta format) |
| **Outbound Text** | Supported | Supported | Supported |
| **Quick Replies** | Supported | Supported (via Body) | Supported |
| **Signature Verify** | SHA256 (`x-hub-signature-256`) | HMAC-SHA1 (`x-twilio-signature`) | Shared with Meta |
| **Delivery Status** | Supported | Supported | Supported |
| **Media (Inbound)** | Partially (Logged) | Not Implemented | Not Implemented |
| **Media (Outbound)** | Not Implemented | Not Implemented | Not Implemented |
| **24h Window** | Enforced | Enforced | Enforced |

## Test Scenarios per Provider

### Meta Cloud API
- Webhook verification (GET).
- Valid signature POST.
- Invalid signature POST (403).
- Text message processing.
- Message status updates (sent, delivered, read).

### Twilio WhatsApp
- Valid signature POST.
- Invalid signature POST (403).
- Text message processing.
- Twilio-specific status updates.

### 360dialog
- Webhook processing (uses Meta Cloud payload format).
- Credential validation.
