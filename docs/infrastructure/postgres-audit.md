# PostgreSQL Inspection - ReplyBase

## Connection Strategy
- **Client:** Prisma with `pg` pool adapter.
- **Pool Size:** 50 (Production), 20 (Development).
- **Timeout:** 30s idle, 5s connection.

## Identified Risks

### 1. Connection Memory Overhead
**Finding:** The production pool size of 50 is excessive for a 4GB RAM Droplet.
**Risk:** High.
**Impact:** PostgreSQL consumes significant RAM for each open connection (\approx 10-15MB). 50 connections consume ~500-750MB of RAM, which is ~15-20% of the total available system memory. This starves the Node.js process and Redis.
**Recommendation:** Reduce `max` connections in `lib/prisma.ts` to 15-20. Node.js is highly efficient with async connections; 20 connections can handle hundreds of concurrent requests.

### 2. Analytics Performance (JS vs SQL)
**Finding:** `lib/analytics.ts` fetches raw conversation data and performs mapping/reduction in JavaScript.
**Risk:** Medium.
**Impact:** As the number of messages per tenant grows, fetching all rows into Node.js memory just to count them will cause CPU spikes and potential OOMs in the application layer.
**Recommendation:** Refactor analytics to use Prisma's `_count` and `groupBy` aggregations, pushing the work to the database engine.

### 3. Log Retention Gap (Storage Pressure)
**Finding:** Raw message payloads are stored in `WebhookLog` and `ExecutionLog`. There is no automated cleanup.
**Risk:** High.
**Impact:** These tables will grow linearly with message volume. Without cleanup, they will eventually exceed the 120GB disk limit, crashing the entire infrastructure.
**Recommendation:** Implement a cron-based cleanup to delete logs older than 30 days.

### 4. Transaction Atomicity
**Finding:** Many webhook handlers perform multiple separate Prisma calls instead of using `prisma.$transaction`.
**Risk:** Medium.
**Impact:** Inconsistent state if the process crashes midway (e.g., Message created but Usage not incremented).
**Recommendation:** Use `prisma.$transaction` for critical paths (Ingestion -> Message -> Usage).

## Realistic Connection Limits
- **Startup (<50 tenants):** 15-20 connections.
- **Growth (50-250 tenants):** 30-40 connections (requires Droplet RAM upgrade).
- **Scale (250+ tenants):** Deploy PgBouncer or switch to a Managed PostgreSQL service.
