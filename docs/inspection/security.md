# Security & Multi-Tenant Isolation Master Audit - ReplyBase (August 2026)

## 1. Multi-Tenant Isolation Architecture
- **Layer**: Database Level (Prisma).
- **Mechanism**: Standardized usage of `getTenantPrisma(tenantId)` extension. This automatically injects `where: { tenantId }` into all supported queries (Find, Update, Delete) and enforces `data: { tenantId }` on creations.
- **Verification**: August 2026 audit confirmed 100% coverage on core messaging and contact entities.
- **Legacy Risk**: Identified ~60 API routes still using manual session lookups and `prisma.user.findUnique` patterns. Task 037 is active to refactor these to the `withAuthAndTenant` middleware.
- **Worker Isolation**: Standardized. `facebook-worker.ts`, `whatsapp-worker.ts`, and `telegram-worker.ts` all utilize `getTenantPrisma(tenantId)` to ensure isolated database access during background processing.
- **Data Export**: Standardized. The `/api/user/data-export` route has been refactored to use `withAuthAndTenant` and `withAdmin`, ensuring proper session validation and scoped database access (Task 043 partially completed).
- **Residual Manual Scoping Risks**: While core workers and export routes are hardened, residual technical debt remains in `app/api/tenant/channels/route.ts`, `app/api/tenant/lead-notifications/route.ts`, `app/api/tenant/lead-notifications/test/route.ts`, and `app/api/analytics/onboarding-milestones/route.ts`, which still utilize legacy `getServerSession` lookups. Task 043 remains open to finalize these edge cases.

## 2. Authentication & Authorization
- **Provider**: NextAuth.js with JWT Strategy.
- **Context**: JWT is enriched with `tenantId`, `userId`, and `role` (USER, ADMIN, SUPERADMIN).
- **RBAC Enforcement**:
  - `withAuthAndTenant`: Ensures a valid session and provides a scoped DB client.
  - `isPlatformAdmin`: Utility used in `/api/admin/*` routes to restrict access to Superadmins.
- **Audit Logging**: Granular "Read-access" and "Write-access" logging implemented for Superadmins via `AdminActivity` table (Task 021).

## 3. API & Webchat Security
- **CORS**: Strict per-site allowed domains whitelisting for webchat widgets (Task 028/030). Blocked 403 response for unauthorized origins.
- **AI Guardrails**: Standardized LLM guardrail prompts and regex-based injection detection (`containsPromptInjection`) implemented in `lib/ai-fallback.ts` (Task 036).
- **Idempotency**: Message processing and billing events use a DB-backed `IdempotencyKey` table to prevent replay attacks and duplicate processing.

## 4. Threat Model & Risk Assessment
- **IDOR**: Low risk on scoped models; Medium risk on legacy routes and data export utilities (Task 037/043 mitigation underway).
- **Injection**: High-quality protection via Prisma parameterized queries.
- **Prompt Injection**: Mitigated via hard-coded system prompt prefixes and runtime detection.
- **PII Exposure**: Minimal; only authorized tenants can access their own contact data. Superadmin access is audited.

## 5. Security Roadmap
1. **API Standardization (HIGH)**: Complete Task 037/043 to eliminate manual scoping in internal routes and background workers.
2. **Enterprise IAM (MEDIUM)**: Transition to granular roles (Owner, Admin, Agent, Viewer) per `docs/proposals/enterprise-iam.md`.
3. **Automated Scanning (LOW)**: Integrate Snyk/Dependabot for dependency vulnerability tracking.
