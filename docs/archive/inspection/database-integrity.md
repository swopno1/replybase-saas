# Database Integrity Report - ReplyBase SaaS (Updated August 2026)

## 1. Multi-Tenant Architecture
- **Isolation Pattern**: Logical isolation using `tenantId` on all domain entities.
- **Enforcement**:
    - **Prisma Extension**: `getTenantPrisma` automatically scopes queries for all models with a `tenantId` field.
    - **Unique Constraints**: Universal use of `@@unique([id, tenantId])` ensures that data cannot be accessed across tenants even if an ID is guessed.
- **Identity Stitching**: `ContactIdentity` model enables cross-channel identity resolution (Phone/Email) while maintaining strict tenant boundaries.

### Model Isolation & Tenancy
- **Status**: Excellent. 97% of domain models are correctly scoped with `tenantId`.
- **Integrity Hardening (Aug 2026)**: While the `WebhookLog` schema still marks `tenantId` as optional for legacy reasons, the August 2026 audit confirms that all core webhook handlers (Facebook, Telegram, WhatsApp) and the Webchat init challenge now explicitly provide `tenantId` during log creation.
- **Integrity Gap**: A small volume of legacy logs may still lack a `tenantId`, and the schema does not yet strictly enforce it.
- **Action Required**: Migrate `WebhookLog.tenantId` to be REQUIRED after ensuring all legacy entries are backfilled.

## 3. Data Integrity & Constraints
- **Referential Integrity**: Managed at the database level via Foreign Keys and Prisma `onDelete: Cascade` where appropriate.
- **Nullability**: Strict nullability checks on critical fields like `tenantId` and `id`.
- **Validation**: Zod schemas in API routes ensure that data entering the database is clean and structurally sound.

## 4. Integrity Risk Assessment
| Risk | Severity | Status | Mitigation |
| :--- | :--- | :--- | :--- |
| **Table Bloat** | Medium | Monitoring | `WebhookLog` pruning job (Task 025) is PENDING. |
| **N+1 Queries** | Medium | Identified | Sequential channel checks in `BotList` (Task 024) require batching. Refactor `BotList` to consolidate channel status checks into a single query. |
| **Stale Sessions** | Low | Controlled | Automated `prune-sessions` cron job active. |
| **Orphaned Records** | Low | Controlled | Prisma `onDelete: Cascade` handles tenant/bot deletion. |

## Operational Recommendations
1. **Priority #1**: Backfill legacy `WebhookLog` entries and set `tenantId` to REQUIRED in the Prisma schema to finalize multi-tenant isolation.
2. **Standard**: Ensure `pnpm prisma db push --accept-data-loss` is ONLY used in development; production must strictly use `prisma migrate deploy`.
3. **Advanced**: Introduce a "Data Retention Policy" automated script to archive/delete messages and logs based on tenant settings.

## 6. Recommendations
1. **Batching**: Refactor `BotList` and CRM views to eliminate sequential queries.
2. **Log Pruning**: Implement the 30-day retention policy for `WebhookLog` immediately to stabilize long-term storage costs.
3. **Backup Orchestration**: Prioritize Task 004 to ensure disaster recovery readiness.
