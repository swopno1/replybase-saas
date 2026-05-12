# Performance & Scalability Report - ReplyBase SaaS (Updated July 2026)

## Bottleneck Analysis

### 1. Synchronous vs Asynchronous
- **Webhook Processing**: Fully migrated to BullMQ. Inbound hooks from Meta/Telegram/WhatsApp receive an immediate 200 OK, with heavy processing (AI, DB updates) handled by background workers.
- **AI Latency**: Responses are streamed via `ai-fallback.ts` using Vercel AI SDK, significantly improving perceived UX.

### 2. Database Performance
- **Query Efficiency**: Scoped Prisma queries are efficient due to `tenantId` indexing.
- **Caching Opportunity**: Dashboard metrics (Lead counts, Conversion rates, Active sessions) are currently calculated on-the-fly. These should be cached in Redis with a 5-minute TTL to reduce DB load during high concurrent user sessions.
- **N+1 Issues**: Batching has been implemented for Message and Lead lookups, but the `BotList` component still performs individual channel status checks that could be consolidated into a single join.

### 3. Usage Logging
- **Buffering**: `UsageBuffer` in `lib/subscription.ts` effectively batches usage increments (messages, executions). This prevents the database from being overwhelmed by high-frequency writes during broadcast events.

## Infrastructure Readiness
- **Redis Persistence**: BullMQ and Rate Limiting rely on Redis. In production, Redis must be configured with `appendonly yes` to prevent job loss on restart.
- **Queue Scaling**: The `outbound-webhooks` queue is currently on the same Redis instance as message processing. High volume may require a dedicated Redis instance for webhooks to prevent delay in core bot responses.

## Metrics & KPIs
- **Target Throughput**: 100+ messages per second per worker instance.
- **Target Latency**: Webchat initial handshake < 300ms; AI response start < 1500ms.

## Optimization Roadmap
1. **Redis Caching**: Implement `getDashboardStats` with Redis-based caching. Target: Dashboard metrics with a 300s TTL.
   - *Strategy*: Follow the L1/L2 pattern in `lib/subscription.ts`. Cache results of heavy aggregations (`CRMMessage` counts, `Lead` status counts) in Redis with `dashboard:stats:[tenantId]` key.
2. **N+1 Consolidation**: Refactor `BotList` and `ChannelConfig` to fetch channel statuses in a single batched query per bot rather than individual calls.
3. **Log Pruning**: Implement a cron job to move `WebhookLog` entries older than 30 days to cold storage or delete them.
4. **Asset Optimization**: Optimize the Webchat Widget bundle size (currently ~120kb) to improve initial page load on client sites.
