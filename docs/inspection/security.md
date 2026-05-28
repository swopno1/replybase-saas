# Security & Multi-Tenant Isolation Master Audit - ReplyBase (August 2026)

## 1. Multi-Tenant Isolation Architecture
- **Layer**: Database Level (Prisma).
- **Mechanism**: Standardized usage of `getTenantPrisma(tenantId)` extension. This automatically injects `where: { tenantId }` into all supported queries (Find, Update, Delete) and enforces `data: { tenantId }` on creations.
- **Verification**: August 2026 audit confirmed 100% coverage on core messaging and contact entities.
- **Standardization Progress**: Core messaging workers (`facebook`, `whatsapp`, `telegram`) and the Data Export API are now fully standardized.
- **Residual Technical Debt (HIGH)**: Identified ~50 API routes still using manual `getServerSession` lookups and manual `prisma` scoping. Specific high-risk areas include:
  - `app/api/tenant/channels/route.ts`
  - `app/api/tenant/lead-notifications/route.ts`
  - `app/api/flows/from-template/route.ts`
  - `app/api/analytics/onboarding-milestones/route.ts`
  - `app/api/flows/[id]/assign/route.ts`
  - `app/api/flows/[id]/clone/route.ts`
  - `app/api/flows/[id]/duplicate/route.ts`

## 2. Authentication & Authorization
- **Provider**: NextAuth.js with JWT Strategy.
- **Context**: JWT is enriched with `tenantId`, `userId`, and `role` (USER, ADMIN, SUPERADMIN).
- **RBAC Limitations**: Current roles are platform-centric. Tenant-level RBAC (Owner, Admin, Agent, Viewer) is proposed but not yet implemented (See `docs/proposals/enterprise-iam.md`).
- **Middleware Enforcement**:
  - `withAuthAndTenant`: Ensures a valid session and provides a scoped DB client.
  - `isPlatformAdmin`: Utility used in platform-wide admin routes.
- **Audit Logging**: Granular "Read-access" and "Write-access" logging implemented for Superadmins. Tenant-level audit logs via `ActivityLog` are present but underutilized for configuration changes.

## 3. API & Webchat Security
- **CORS**: Strict per-site allowed domains whitelisting for webchat widgets. Blocked 403 response for unauthorized origins.
- **AI Guardrails**: Standardized LLM guardrail prompts and regex-based injection detection implemented in `lib/ai-fallback.ts`.
- **Idempotency**: Message processing and billing events use a DB-backed `IdempotencyKey` table. Confirmed `app/api/webchat/message/route.ts` uses a 5-minute expiry for idempotency keys.

## 4. Threat Model & Risk Assessment
- **IDOR**: Low risk on scoped models; **High risk** on legacy routes using manual scoping where filters might be omitted in future updates.
- **Injection**: High-quality protection via Prisma parameterized queries.
- **Prompt Injection**: Mitigated via hard-coded system prompt prefixes and runtime detection.
- **PII Exposure**: Minimal; only authorized tenants can access their own contact data. Superadmin access is audited.

## 5. Security Roadmap
1. **Middleware Standardization (CRITICAL)**: Migrate all remaining `getServerSession` routes in `app/api/tenant`, `app/api/flows`, and `app/api/analytics` to `withAuthAndTenant` or `withAdmin`.
2. **Enterprise IAM (MEDIUM)**: Transition to granular tenant roles (Owner, Admin, Agent, Viewer) per proposal.
3. **Automated Scanning (LOW)**: Integrate Snyk/Dependabot for dependency vulnerability tracking.
