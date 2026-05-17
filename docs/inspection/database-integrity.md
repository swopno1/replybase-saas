# Database Integrity & Multi-Tenancy Master Audit - ReplyBase SaaS (Updated August 2026)

## 1. Multi-Tenant Architecture
- **Isolation Pattern**: Logical isolation using `tenantId` on all domain entities.
- **Enforcement**:
    - **Prisma Extension**: `getTenantPrisma` automatically scopes queries for all models with a `tenantId` field.
    - **Unique Constraints**: Universal use of `@@unique([id, tenantId])` ensures that data cannot be accessed across tenants even if an ID is guessed.
- **Identity Stitching**: `ContactIdentity` model enables cross-channel identity resolution (Phone/Email) while maintaining strict tenant boundaries.

## 2. Schema Health & Normalization
- **Prisma Standard**: Currently on Prisma 7.8.0.
- **Migrations**: Strict "Migrate-Only" policy for production. Migrations are baselined and deployed via CI/CD with automated P3005 error handling.
- **Relationships**: Clean relationship mapping between `Tenant` -> `Bot` -> `Channel` -> `Conversation` -> `Message`.
- **JSON Fields**: Used effectively for dynamic configuration (`Channel.config`, `Bot.context`, `Lead.insights`) without losing relational integrity.

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

## 5. Maintenance & Scalability
- **Usage Buffering**: The `UsageBuffer` system is critical for preventing DB lock contention.
- **Indexing**: Optimized indexes on `tenantId`, `createdAt`, and `externalId` fields across all high-volume tables.
- **Backups**: **CRITICAL GAP**: Automated S3 backups (Task 004) are still PENDING.

## 6. Recommendations
1. **Batching**: Refactor `BotList` and CRM views to eliminate sequential queries.
2. **Log Pruning**: Implement the 30-day retention policy for `WebhookLog` immediately to stabilize long-term storage costs.
3. **Backup Orchestration**: Prioritize Task 004 to ensure disaster recovery readiness.
