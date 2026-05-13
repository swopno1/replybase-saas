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
1. **Model Tenancy Gaps (RESOLVED)**: While the `WebhookLog` model in `schema.prisma` still allows `tenantId` to be optional for legacy support, the codebase audit (August 2026) confirms that `tenantId` is now strictly enforced across all primary webhook handlers (Facebook, Telegram, WhatsApp, Webchat).
2. **Unscoped Mutations (RESOLVED)**: All integration management routes (e.g., `app/api/bots/[botId]/channels/`) have been refactored to use `withAuthAndTenant`, eliminating IDOR risks for channel management.
3. **Admin API Surface (PARTIAL)**: Admin routes (`/api/admin/*`) are restricted to `SUPERADMIN` roles. Mutation-heavy actions are logged, but a gap remains in "Read-only" audit logging (viewing PII/tenant data).
4. **Command Injection Risk (RESOLVED)**: The Admin Test Runner (`app/api/admin/tests/route.ts`) was successfully refactored from `exec` to `execFile`, eliminating shell-injection risks.
5. **CORS Hardening**: Webchat API endpoints (`/api/webchat/*`) use dynamic CORS; future hardening will strictly enforce the `allowedDomains` whitelist from the `WebChatSite` model.

## Compliance
- **GDPR**: Full support for data deletion requests, including automated cleanup of user-bound and tenant-bound records.
- **Audit Logging**: `AdminActivity` and `ActivityLog` track sensitive mutations. Granular read-access logging for Superadmins is proposed (Task 021).

## Remediation Roadmap
- **COMPLETED**: Scoped mutation hardening for all channel routes.
- **COMPLETED**: Admin Test Runner security refactor (`execFile`).
- **HIGH**: Implement Granular Admin Audit Logging (Task 021).
- **MEDIUM**: Enforce CORS `allowedDomains` for Webchat site endpoints.
