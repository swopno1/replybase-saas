# Database Integrity Report - ReplyBase SaaS (Updated July 2026)

## Schema Integrity Audit

### Model Isolation & Tenancy
- **Status**: Excellent. 95% of domain models are correctly scoped with `tenantId`.
- **Integrity Gap**: The `WebhookLog` model is currently the only high-volume data model lacking a `tenantId`. While it contains a `source` (e.g., botId or pageId), the lack of a primary `tenantId` makes it difficult to enforce isolation via the Prisma Extension.
- **Action Required**: Add `tenantId` to `WebhookLog` and backfill existing data using `source` mapping.

### Constraints & Validation
- **Idempotency**: `IdempotencyKey` and `StripeEvent` unique constraints successfully prevent duplicate processing across messaging and billing.
- **Lead Integrity**: The `Lead` model uses a composite unique constraint `@@unique([id, tenantId])` which is the gold standard for multi-tenant safety.
- **Plan Enforcement**: Subscription quotas (Bots, Channels, Messages) are enforced at the DB level via transactional increments and checks in `lib/subscription.ts`.

## Performance & Optimization
- **Indexing**:
  - `tenantId` is indexed on all primary models.
  - `createdAt` is indexed on logs for efficient pruning.
  - `facebookId` and `channelId` (E164) are indexed for O(1) webhook routing.
- **Relational Overhead**:
  - CASCADE deletes are properly configured for Tenant and Bot relations, preventing orphaned data.
  - Some high-volume relations (Messages -> Conversations) may eventually need partitioning if message volume reaches millions per tenant.

## Operational Recommendations
1. **Priority #1**: Implement a migration to add `tenantId` to `WebhookLog` to close the security isolation gap. This is the most significant remaining multi-tenant integrity risk.
2. **Standard**: Ensure `pnpm prisma db push --accept-data-loss` is ONLY used in development; production must strictly use `prisma migrate deploy`.
3. **Advanced**: Introduce a "Data Retention Policy" automated script to archive/delete messages and logs based on tenant settings.

## Current Health Rating: 9/10
The database schema is robust, well-indexed, and designed for high-scale multi-tenant operations. Resolving the `WebhookLog` tenancy issue will bring it to 10/10 for security isolation.
