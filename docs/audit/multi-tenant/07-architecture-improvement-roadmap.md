# Architecture Improvement Roadmap

## Phase 1: Immediate Risks (0–72 hours)
1.  **Atomic Scoping**: Update all `prisma.update` and `prisma.delete` calls in API routes to include `tenantId` in the `where` clause directly: `where: { id, tenantId }`.
2.  **Standardize DB Client**: Enforce the use of `db` (pre-scoped client from `withAuthAndTenant`) for all domain-level operations in API routes.
3.  **Global Middleware**: Finalize a `proxy.ts` that enforces authentication for all `/api/(dashboard|admin)/*` routes, reducing the risk of unprotected endpoints.

## Phase 2: Short-term Fixes (1–2 weeks)
1.  **Service Layer Extraction**: Refactor complex logic from `app/api/` into `lib/services/`. Each service method should accept `tenantId` as a mandatory first parameter.
2.  **Composite Unique Keys**: Add composite unique constraints `(id, tenantId)` to the database schema for all major domain models (Bot, Flow, Contact, Lead) to provide a hard database-level guarantee against cross-tenant access via ID.
3.  **Audit Log Automation**: Implement a Prisma extension that automatically records `ActivityLog` entries for all mutations, capturing the `tenantId` and `userId` from the context.

## Phase 3: Long-term Architecture Hardening (1–3 months)
1.  **PostgreSQL Row Level Security (RLS)**: Implement RLS at the database level. Use `SET LOCAL app.current_tenant_id = '...'` within transactions. This is the gold standard for multi-tenant isolation.
2.  **Strict TypeScript Enforcement**: Eliminate `any` from Prisma extensions and API response types. Use branded types for IDs (e.g., `TenantId`, `BotId`) to prevent mixing them up.
3.  **Tenant-Aware AI Rate Limiting**: Implement a credit-based system for AI usage that tracks tokens/messages per tenant in real-time via Redis, preventing cost overruns from individual accounts.
