# Performance & Scalability Report - ReplyBase SaaS

## Bottleneck Analysis

### 1. Synchronous vs Asynchronous
- **Webhook Processing**: Moved to BullMQ. Providers receive an immediate 200 OK, preventing timeouts.
- **AI Latency**: Responses are streamed via `ai-fallback.ts`, significantly improving perceived UX.

### 2. Database Performance
- **Query Efficiency**: Scoped Prisma queries are generally fast due to `tenantId` indexing.
- **N+1 Issues**: Resolution time analytics and dashboard summaries are optimized, but frequent manual counts in `BotList` could be cached in Redis.

### 3. Usage Logging
- **Buffering**: `UsageBuffer` in `lib/subscription.ts` implements an in-memory buffer with a 10s flush interval. This prevents the database from becoming a bottleneck during message bursts.

## Infrastructure Readiness
- **Redis**: Required for BullMQ and Rate Limiting. Must be configured with persistence.
- **Serverless Limits**: Use of `waitUntil` or long-running workers is critical. BullMQ workers should run as persistent processes or dedicated containers.

## Metrics & KPIs
- **Throughput**: BullMQ can handle thousands of concurrent jobs depending on CPU/RAM allocation.
- **Latency**: Webchat message processing target: < 500ms (excluding AI generation time).

## Optimization Roadmap
1. **Caching**: Implement Redis caching for dashboard stats (Active Leads, Recent Conversations).
2. **Queue Scaling**: Separate `lead-enrichment` into its own dedicated queue if volume increases.
3. **Log Rotation**: Implement periodic pruning of `WebhookLog` and `ActivityLog` older than 30 days.
