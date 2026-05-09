# Security Audit Report - ReplyBase SaaS

## Authentication & Authorization
- **Provider**: Auth.js (NextAuth) with Google, Facebook, and Email/Password.
- **Session Security**: JWT-based sessions with `AUTH_SECRET` enforcement.
- **Middleware**: Root-level middleware enforces a "Default Deny" policy for protected routes (`/api/*`, `/admin/*`, `/settings/*`).

## Multi-Tenant Isolation
- **Primary Mechanism**: Prisma Client Extension (`getTenantPrisma`) automatically injects `tenantId` into all queries.
- **Secondary Mechanism**: `withAuthAndTenant` wrapper provides a pre-scoped client to API handlers.
- **Manual Oversight**: Public routes (`/api/public/*`) and Admin routes (`/api/admin/*`) bypass this extension and require manual scoping.

## Infrastructure Security
- **Webhook Protection**:
  - **Meta**: X-Hub-Signature-256 verification using `WHATSAPP_APP_SECRET`.
  - **Telegram**: X-Telegram-Bot-Api-Secret-Token verification.
  - **Stripe**: Signature verification on billing webhooks.
- **Secrets Management**: Integration keys (WhatsApp Tokens, Telegram Tokens) are encrypted using `AES-256-GCM` before storage.

## Identified Risks
1. **Model Gaps**: `WebhookLog` does not contain `tenantId`, creating a cross-tenant log leakage risk.
2. **Admin API Surface**: Admin routes have full access to all tenants; strict MFA should be enforced for admin users.
3. **Check-then-Act**: A few legacy routes perform a validation check followed by a mutation using only the record ID. These should be combined into a single atomic query: `where: { id, tenantId }`.

## Compliance
- **GDPR**: Data deletion requests are supported (`/api/cron/process-data-deletions`).
- **Audit Logging**: `AdminActivity` and `ActivityLog` track sensitive changes across the platform.
