# Performance, Infrastructure & DevOps Master Audit - ReplyBase SaaS (Updated August 2026)

## 1. Bottleneck Analysis & Optimization

### Asynchronous vs Synchronous Processing
- **Webhook Architecture**: Fully migrated to BullMQ. Inbound hooks from Meta/Telegram/WhatsApp receive an immediate 200 OK.
- **AI Latency**: Responses are streamed via `ai-fallback.ts` using the Vercel AI SDK.
- **Sequential Write Bottleneck (VERIFIED - Task 041)**: `app/api/webchat/message/route.ts` executes multiple database writes sequentially (Idempotency -> Message -> Lead Extractions) without transactional grouping. This increases connection holding time and handshake latency.

### Database Performance & Query Efficiency
- **Dashboard Metric Aggregation (PENDING - Task 011)**: Dashboard metrics are computed in real-time. `app/(dashboard)/page.tsx` executes several independent `prisma` calls outside of its main `Promise.all` block (e.g., `firstAutomatedReply`, `leadNotificationSettings`), adding to total TTFB.
- **N+1 Identification (MEDIUM - Task 024)**: Identified an N+1 pattern in `lib/subscription.ts`'s `handlePlanDowngrade` which fetches channels sequentially for each bot.
- **CRM Polling Overhead (VERIFIED - Task 033/042)**: `ConversationPage` uses a 5-second interval poll for full-page re-fetches, creating significant server load and "steppy" UX.
- **Prisma Scoping Overhead**: Universal `tenantId` indexing is efficient, but manual scoping in legacy routes increases the risk of unoptimized queries if indexes are bypassed.

### Usage Logging & Infrastructure
- **Usage Buffering**: `UsageBuffer` batches updates and flushes every 10s. Flushes are executed via `upsert` which is efficient for low-concurrency but may face contention during bursts.
- **Redis RAM Safety**: Redis is utilized for BullMQ and L2 caching. Hard-coded limits (256MB) are recommended for low-resource environments.
- **AI Provider Failover**: Successfully migrated to DigitalOcean AI. Failover logic in `lib/ai-fallback.ts` is parallelized to minimize latency.

## 2. Infrastructure & Deployment Architecture
- **Platform**: Dockerized for DigitalOcean/Coolify.
- **Connection Pooling**: Optimized in `lib/prisma.ts` but threatened by sequential write patterns in high-volume routes.
- **Worker Scaling**: BullMQ workers are horizontally scalable.

## 3. DevOps & Production Readiness
- **GAP**: Automated backup orchestration for PostgreSQL and Redis remains a critical infrastructure technical debt (Task 004).
- **GAP**: Deep health diagnostics for DB/Redis are implemented (Task 039) but not yet exposed in a dedicated admin dashboard (Task 031).

## 4. Performance & Scalability Roadmap
1. **Sequential Write Transactionalization (HIGH - Task 041)**: Group webchat ingestion writes into a single `prisma.$transaction`.
2. **Dashboard Query Optimization (MEDIUM)**: Consolidate all dashboard data fetching into a single optimized `Promise.all` or a cached view.
3. **Real-time CRM (MEDIUM - Task 033/042)**: Replace 5s polling with SSE/WebSockets.
4. **Redis Metrics Caching (MEDIUM - Task 011)**: Implement 300s TTL cache for dashboard stats.
5. **N+1 Remediation (LOW)**: Batch channel fetching in `handlePlanDowngrade`.

## 5. Metrics & KPIs
- **Throughput**: Target 100+ messages per second per worker instance.
- **Latency**: Webchat handshake target < 300ms (currently impacted by sequential writes).
