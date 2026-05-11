# Security Audit Report - ReplyBase SaaS (Updated July 2026)

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

## Identified Risks & Vulnerabilities
1. **Model Tenancy Gaps (VERIFIED)**: While the `WebhookLog` model in `schema.prisma` still allows `tenantId` to be optional, an audit of the codebase (`Facebook`, `Telegram`, `WhatsApp`, `Webchat`) confirms that `tenantId` is consistently passed during log creation in all primary webhook routes.
2. **Unscoped Mutations (RESOLVED)**: Legacy integration routes have been refactored.
   - **Status**: `app/api/bots/[botId]/channels/[channelId]/route.ts` now uses `withAuthAndTenant`, ensuring all mutations (GET, PATCH, DELETE) are strictly scoped to the authenticated tenant.
   - **Risk Mitigation**: The platform is now hardened against IDOR for channel management.
3. **Admin API Surface**: Admin routes (`/api/admin/*`) have broad access. While restricted to `SUPERADMIN` roles, they lack granular audit logging for data-viewing actions, only tracking mutations.
4. **CORS Hardening**: Webchat API endpoints (`/api/webchat/*`) have dynamic CORS but should be further restricted to only allow verified domains stored in the `WebChatSite` model.

## Compliance
- **GDPR**: Data deletion requests are supported (`/api/cron/process-data-deletions`).
- **Audit Logging**: `AdminActivity` and `ActivityLog` track sensitive changes across the platform.

## Remediation Roadmap
- **Immediate**: Add `tenantId` to `WebhookLog` and enforce it in all loggers.
- **High**: Refactor all channel management DELETE routes to use the scoped `db` client from `withAuthAndTenant`.
- **Medium**: Implement IP-based rate limiting on all public-facing auth routes.
