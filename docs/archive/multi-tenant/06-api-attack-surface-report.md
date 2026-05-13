# API Surface Attack Analysis

## Endpoint Risk Classification

### 1. High Risk (Publicly Accessible)
- `/api/public/leads`: Open to the internet. Relies on `publicKey` and Origin header validation.
  - **Risk**: `publicKey` is not a secret (exposed in JS snippets). Rate limiting is the primary defense against lead-spamming and tenant resource exhaustion.
- `/api/whatsapp/webhook`, `/api/facebook/webhook`, `/api/telegram/webhook`: Entry points for messaging data.
  - **Risk**: Signature verification must be 100% robust to prevent spoofing of incoming messages.

### 2. Medium Risk (Authenticated Dashboard APIs)
- `/api/flows/[id]`, `/api/bots/[botId]`, `/api/contacts/[contactId]`:
  - **Risk**: IDOR vulnerabilities due to inconsistent tenant scoping in mutations (as noted in Report 02).

### 3. Low Risk (Admin-Only APIs)
- `/api/admin/*`:
  - **Risk**: Role escalation if `isPlatformAdmin` checks are missed.

## Unauthorized Access Possibilities
- **Predictable IDs**: The system uses `cuid()` for IDs. While not as predictable as auto-incrementing integers, they are still shorter and more guessable than UUID v4.
- **Tenant Enumeration**: Error messages like "Tenant not found" vs "Unauthorized" can be used to enumerate valid tenant or user IDs.

## Rate-Limit Bypass Scenarios
- **Webchat Init**: `/api/webchat/init` and `/api/webchat/message` use an IP-based rate limiter. Distributed attacks from multiple IPs could still overwhelm the system or incur high AI costs for a specific tenant.
- **Global Redis Limiter**: Ensure the rate limiter key includes the `tenantId` or `botId` to prevent one noisy tenant from exhausting the global rate limit bucket for others.
