# PostgreSQL Row Level Security (RLS) Investigation for Tenant Isolation

## Overview
Currently, Replybase SaaS implements multi-tenant isolation at the application layer by manually appending `tenantId` to Prisma queries. This approach relies on developer discipline and is prone to human error, which could lead to cross-tenant data leaks.

Row Level Security (RLS) in PostgreSQL offers a database-level safeguard. It allows us to define security policies directly on tables, ensuring that any query executed by a specific user or role automatically applies a filter (e.g., `tenantId = current_setting('app.current_tenant_id')`).

## Feasibility with Prisma
Prisma natively connects to the database as a single user defined in `DATABASE_URL`. Historically, this made RLS difficult to implement dynamically per request. However, with Prisma Client Extensions, it is now feasible.

**Approach using Prisma Client Extensions:**
We can create a Prisma extension that injects the `tenantId` into the PostgreSQL execution context for every transaction.

```typescript
// Conceptual example
const prismaWithRLS = (tenantId: string) => {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, TRUE)`,
            query(args),
          ])
          return result
        },
      },
    },
  })
}
```

This extension ensures that before the actual query runs, the database session is scoped to the tenant. The RLS policies in PostgreSQL will then automatically filter the data.

## Performance Impact
Implementing RLS via the `set_config` transaction pattern does introduce overhead:
1.  **Transaction Overhead:** Every query becomes a transaction with at least two statements (setting the config, then the query). This increases latency.
2.  **Connection Pooling:** Depending on the setup, keeping sessions stateful with `set_config` can interfere with connection poolers like PgBouncer in transaction mode unless handled very carefully (e.g., using `TRUE` for local transaction scope).
3.  **Query Planner:** In some complex queries, RLS policies might obscure the best execution paths for the query planner, though usually, simple `tenant_id = current_setting()` checks are fast if `tenant_id` is indexed.

*Recommendation:* The overhead is generally acceptable for standard SaaS traffic, but should be load-tested specifically in our environment before full rollout.

## Phased Adoption Plan

If we decide to proceed, we should adopt RLS gradually to minimize disruption:

1.  **Phase 1: Proof of Concept & Policy Definition (Development)**
    *   Define RLS policies on a low-risk table (e.g., `ActivityLog` or `WebhookLog`).
    *   Create the Prisma Client Extension.
    *   Write tests to verify that data is filtered at the DB level, even if the application layer forgets the `where` clause.
2.  **Phase 2: Performance Testing**
    *   Run k6 load tests using the RLS extension.
    *   Compare p95 latency and throughput against the current application-level implementation.
3.  **Phase 3: Dual Execution (Staging)**
    *   Apply RLS policies to all tenant-scoped tables (`Lead`, `Contact`, `CrmMessage`, etc.).
    *   Keep the existing application-layer `where: { tenantId }` checks. This provides defense-in-depth and helps the Prisma query engine cache effectively.
    *   Monitor staging logs for any RLS violation errors or unexpected missing data.
4.  **Phase 4: Production Rollout**
    *   Deploy policies to production via Prisma migrations (`--create-only` then apply raw SQL for policies).
    *   Deploy the application update using the RLS-extended Prisma client.
    *   (Optional) Gradually refactor and remove repetitive `tenantId` where clauses from application code, relying on the DB layer.

## Conclusion
RLS is a highly desirable architectural improvement for Replybase SaaS. It provides a robust, defense-in-depth layer against data leaks. The Prisma Client Extension approach makes it feasible, though the performance implications must be thoroughly validated in Phase 2 before wide-scale adoption.
