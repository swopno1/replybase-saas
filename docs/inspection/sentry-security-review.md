# Sentry Security & Privacy Review

## 1. Data Privacy Audit
- **Risk**: Current `sendDefaultPii: true` is dangerous. It can capture User IP, Email, and potentially Auth headers if not carefully managed.
- **Risk**: `includeLocalVariables: true` can expose sensitive keys, tokens, or raw PII from the local scope during a crash.

## 2. Sanitization Requirements
### Environment Variables
Ensure the following are NEVER sent to Sentry (checked via `beforeSend`):
- `STRIPE_SECRET_KEY`
- `DIGITALOCEAN_AI_KEY`
- `AUTH_SECRET`
- `DATABASE_URL`

### Payloads
Sanitize the following in breadcrumbs:
- `accessToken` (Facebook/WhatsApp)
- `password` / `hashedPassword`
- `apiKey`

## 3. Sentry Tunneling
The project uses `/monitoring` as a tunnel route.
- **Verification**: Ensure Next.js Middleware does not block requests to `/monitoring`.
- **Benefit**: This protects against ad-blockers and ensures 100% of errors are captured from "privacy-conscious" browsers.

## 4. Multi-Tenant Privacy
When tagging `tenant_id`, ensure NO tenant-specific sensitive data (like customer names or raw message content) is used as a high-cardinality tag. Keep high-cardinality data in **Context** or **Breadcrumbs**, not **Tags**, for better Sentry performance and cost control.

## 5. Compliance
- Set up a **Data Retention Policy** in Sentry (e.g., 30 or 90 days).
- Enable **PII Scrubbing** at the Sentry Organization level.

---
