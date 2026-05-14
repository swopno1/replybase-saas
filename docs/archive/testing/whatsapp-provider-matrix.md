# WhatsApp Provider Feature Matrix

This document compares the capabilities and configurations of the different WhatsApp providers supported by ReplyBase.

| Feature | Meta Cloud API | Twilio WhatsApp | 360dialog v2 |
|---------|----------------|-----------------|--------------|
| **Setup Type** | Direct (Graph API) | Proxy (TwiML/Webhook) | Partner (Meta-compatible) |
| **Authentication** | System User Token | Account SID + Auth Token | API Key |
| **Signature Type** | HMAC-SHA256 (X-Hub) | HMAC-SHA1 (X-Twilio) | HMAC-SHA256 (Meta-format) |
| **Media Support** | Native | Supported | Native |
| **Interactive Buttons** | Supported (up to 3) | Limited | Supported |
| **24h Window** | Enforced by Provider | Enforced by Provider | Enforced by Provider |
| **Delivery Status** | Detailed Status Events | Status Callback URL | Detailed Status Events |

## Provider Specific Implementation Details

### 1. Meta Cloud API
- **Normalization**: Strips `whatsapp:` prefix, uses raw E164 digits for Graph API.
- **Security**: Requires `appSecret` for webhook validation. If missing, falls back to environment variable `WHATSAPP_APP_SECRET`.

### 2. Twilio WhatsApp
- **Normalization**: Requires `whatsapp:` prefix in `To` and `From` fields for API calls.
- **Security**: Uses standard Twilio signature verification. The URL must exactly match the configured webhook URL in Twilio console.

### 3. 360dialog v2
- **Compatibility**: Uses the same webhook format as Meta Cloud API.
- **Validation**: Connection is validated by checking the `/api/v2/contacts` endpoint.

## Recommendation
- **High Volume**: Meta Cloud API (Lowest cost, native features).
- **Ease of Setup**: Twilio (Managed infrastructure, shared numbers).
- **International/Regional**: 360dialog (Strong presence in Europe/Brazil).
