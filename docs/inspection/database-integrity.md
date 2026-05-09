# Database Integrity Report - ReplyBase SaaS

## Schema Audit

### Model Isolation
- **Tenant-Scoped**: Most models include `tenantId` and are part of the automated isolation layer.
- **Global Models**: `User`, `Tenant`, `Plan`, `IdempotencyKey`, `DemoTemplate`.
- **Integrity Gap**: `WebhookLog` model lacks a `tenantId` field. This causes cross-tenant log mixing and makes log querying inefficient at scale.

### Relational Integrity
- **OnDelete Policies**: Consistent use of `CASCADE` on `tenantId` and `conversationId` relations ensures clean data removal during tenant deletion.
- **IDOR Protection**: Many lookups now use composite unique constraints or scoped queries (`{ id, tenantId }`).

## Performance & Indexing
- **Tenant Indices**: `tenantId` is indexed on almost all domain models.
- **Search Indices**: `email` and `status` on the `Lead` model are indexed for fast dashboard filtering.
- **Bottlenecks**:
  - `WebhookLog` lacks sufficient indexing for type-based filtering.
  - `UsageLog` uses a composite unique constraint (`tenantId_type_date_botId_channelId`) which is excellent for deduplication but requires careful monitoring of index size.

## Recommendations
1. **Critical**: Add `tenantId` to `WebhookLog` model and update associated loggers.
2. **Standard**: Ensure all migrations use `npx prisma migrate deploy` to prevent schema drift.
3. **Advanced**: Implement DB-level Row Level Security (RLS) for defense-in-depth against application-level bypass.
