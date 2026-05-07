# Database & Prisma Risk Report

## Missing Tenant Filters
A deep scan of the codebase reveals several areas where the global `prisma` client is used without the `getTenantPrisma` extension, leading to "Manual Filtering" requirements.

| Resource | File | Unsafe Pattern |
|----------|------|----------------|
| **Bots** | `app/api/bots/[botId]/route.ts` | `prisma.bot.update({ where: { id: botId } })` |
| **Flows** | `app/api/flows/[id]/route.ts` | `prisma.flow.delete({ where: { id: id } })` |
| **Leads** | `app/api/leads/[leadId]/route.ts` | `prisma.lead.update({ where: { id } })` |
| **Contacts** | `app/api/contacts/[contactId]/route.ts` | `prisma.contact.update({ where: { id: contactId } })` |

## Unsafe Prisma Query Patterns
- **findUnique Bypasses Extension**: Prisma's extension for `` might handle `findUnique` by converting it to `findFirst` or injecting into `where`. However, standard `findUnique` requires unique index fields. If `tenantId` is not part of the unique index, the extension must ensure it doesn't break the query or leak data.
- **createMany Scoping**: In `app/api/bots/route.ts`, `createMany` for channels manually includes `tenantId`. If a developer forgets this in a new model, the record will be "orphaned" or potentially mis-attributed.

## Data Integrity Risks
- **Cascading Deletes**: Many models use `onDelete: Cascade` with `Tenant`. This is good for cleanup but dangerous if a `tenantId` is accidentally changed or if a `Tenant` record is deleted.
- **Global Models**: `Flow` has an `isGlobal` flag. The logic `OR: [{ tenantId: user.tenantId }, { isGlobal: true }]` is used in many places.
  - **Risk**: A bug in the query could allow a user to see *all* flows if `tenantId` is accidentally null or if `isGlobal` logic is inverted.

## Billing / Stripe Isolation Issues
- **StripeEvent**: `StripeEvent` lacks a `tenantId` field in the schema. Events are looked up by Stripe ID. While Stripe IDs are globally unique, associating them with a `tenantId` early in the processing pipeline is critical for auditability.
- **Subscription Lookup**: `getTenantSubscriptionStatus` (`lib/subscription.ts`) uses `prisma.subscription.findUnique({ where: { tenantId } })`. This is safe, but the `UsageLog` model uses a composite unique key: `@@unique([tenantId, type, date, botId, channelId])`. This is excellent practice and should be replicated for other models.
