# Performance & Scalability Report - ReplyBase SaaS (Updated August 2026)

## Bottleneck Analysis

### 1. Synchronous vs Asynchronous Processing
- **Webhook Processing**: Fully migrated to BullMQ. Inbound hooks from Meta/Telegram/WhatsApp receive an immediate 200 OK. Heavy processing (AI, DB updates) is handled by background workers.
- **AI Latency**: Responses are streamed via `ai-fallback.ts` using Vercel AI SDK, significantly improving perceived UX. Streaming is also implemented in the webchat message route (`POST /api/webchat/message`).

### 2. Database Performance & Efficiency
- **Query Efficiency**: Scoped Prisma queries are efficient due to `tenantId` indexing.
- **Caching Strategy**:
    - **Implemented**: A dual-layer TTL cache (L1 in-memory Map, L2 Redis) for tenant limits and subscription status in `lib/subscription.ts`.
    - **Opportunity**: Dashboard metrics (Lead counts, Conversion rates) are currently calculated on-the-fly. **Task 011** aims to implement Redis-based caching (`dashboard:stats:[tenantId]`) with a 5-minute TTL.
- **N+1 Issues**: Batching is implemented for Message and Lead lookups. However, `BotList` and `ChannelConfig` still perform sequential channel status checks. These should be consolidated into a single join or batched query.

### 3. Usage Logging & Data Operations
- **Buffering**: `UsageBuffer` system batches usage updates (messages, executions) and flushes them to the database every 10 seconds or upon reaching a threshold, preventing write amplification.
- **Bulk Data Export**: Optimized June 2026 to use targeted `select` statements for large relations, reducing memory pressure in serverless environments.
- **Idempotency**: Replaced in-memory locks with database-level de-duplication (via `IdempotencyKey` or unique constraints in `WebhookLog`).

## Infrastructure & Scalability
- **Connection Pooling**: Uses a centralized PostgreSQL connection pool via `pg.Pool` and `@prisma/adapter-pg`, preventing connection exhaustion.
- **Worker Scaling**: BullMQ adoption prevents Webhook API timeouts. **Recommendation**: Implement concurrency limits per-tenant within BullMQ to prevent resource hogging by viral tenants.
- **Deployment Context**: The current BullMQ architecture is suitable for long-running environments (DigitalOcean/Coolify) but would require adaptation (e.g., Inngest) for pure serverless (Vercel).

## Optimization Roadmap
1. **Redis Metrics Caching (HIGH - Task 011)**: Implement Redis-based caching for dashboard stats with a 300s TTL.
2. **N+1 Consolidation (MEDIUM)**: Refactor `BotList` to fetch channel statuses in a single batched query per bot.
3. **Log Pruning (LOW)**: Implement a cron job to move `WebhookLog` entries older than 30 days to cold storage.
4. **Asset Optimization (LOW)**: Reduce Webchat Widget bundle size (target < 100kb).

## Metrics & KPIs
- **Target Throughput**: 100+ messages per second per worker instance.
- **Target Latency**: Webchat handshake < 300ms; AI response start < 1500ms.
