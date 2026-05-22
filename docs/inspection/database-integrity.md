# Database Integrity & Schema Master Audit - ReplyBase (August 2026)

## 1. Schema Design Standards
- **Relational Consistency**: Strict use of Foreign Keys and Cascading Deletes where appropriate (e.g., deleting a Tenant deletes all associated Bots).
- **Multi-Tenancy**: 100% of tenant-data models include a mandatory `tenantId` field.
- **Indexing Strategy**:
  - All foreign keys are indexed.
  - `tenantId` is indexed on all large tables (`Lead`, `CrmMessage`, `UsageLog`, `ActivityLog`).
  - Partial indexes used where supported (Prisma preview features).

## 2. Integrity Safeguards
- **Unique Constraints**: Gold-standard safety using `@@unique([id, tenantId])` on core entities.
- **Idempotency**: `IdempotencyKey` table used to prevent duplicate operations in background workers and webhooks.
- **DMMF Introspection**: Used by `prisma-tenant` extension to verify model compatibility with automated scoping at runtime.

## 3. Data Evolution & Migrations
- **Tooling**: Prisma Migrate.
- **Production Standard**: `npx prisma migrate deploy` in CI/CD pipeline.
- **Safety**: Large migrations (e.g., adding `tenantId` to legacy logs) were performed using a dual-write/backfill strategy to prevent downtime.

## 4. Current Database Health
- **Total Tables**: ~45.
- **N+1 Status**: Remediated in Bot List (Task 024) and Lead extraction.
- **Storage**: `WebhookLog` bloat mitigated by automated 30-day pruning (Task 025).
- **Connectivity**: Managed via `pg.Pool` and `@prisma/adapter-pg` for efficient pooling and Next.js Edge compatibility where needed.

## 5. Database Roadmap
1. **Read Replicas (LOW)**: Prepare for read-replica support in the `getTenantPrisma` extension for high-traffic analytics.
2. **JSON Schema Validation (MEDIUM)**: Implement Zod-based validation for `Json` fields in Prisma (e.g., `Bot.context`, `Flow.nodes`).
3. **Database Health Diagnostics (LOW - Task 039)**: Implement deep health checks (Prisma ping) in `/api/health`.
