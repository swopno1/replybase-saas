# Performance and Scalability Report: ReplyBase SaaS

## 1. Database Layer
### Current Performance
- **Prisma usage**: Generally efficient, utilizing the Prisma Query Engine for optimized execution.
- **Indexing**: Core entities (Leads, Conversations, Messages) have indices on `tenantId`, `createdAt`, and `contactId`.
- **N+1 Queries**: Refactored WhatsApp status logging to use `createMany`, resolving a major bottleneck during webhook bursts.

### Scalability Bottlenecks
- **Unbounded Queries**: Several dashboard routes (e.g., `app/api/conversations/route.ts`) lack strict pagination. Tenants with 100k+ messages will experience significant latency and memory pressure.
  - **Action**: Enforce `take` and `skip` with a default of 50 records for all list APIs.
- **Large Json fields**: The `insights` field on `Lead` and `context` on `Bot` grow with every interaction.
  - **Action**: Implement a soft cap on Json field sizes and monitor storage growth.

---

## 2. Background Processing (BullMQ + Redis)
### Current Performance
- **Concurrency**: Set to 5 in `lib/queue.ts`. This is safe for launch but insufficient for "Messenger/WhatsApp viral" scenarios.
- **Reliability**: Exponential backoff (starting at 1s) is correctly implemented for message retries.

### Scalability Recommendations
- **Redis Connection Management**: Use `ioredis` connection pooling for BullMQ workers to prevent connection exhaustion.
- **Job Lifecycle**: Set `removeOnComplete: { age: 3600, count: 1000 }` to prevent Redis memory exhaustion from historical job metadata.
- **Worker Isolation**: The architecture supports running `message-processing` and `outbound-webhooks` on separate container instances. **This is mandatory for scaling beyond 1,000 active tenants.**

---

## 3. Application & Frontend Performance
### Current Performance
- **Streaming AI**: Uses Vercel AI SDK `toDataStreamResponse`, providing immediate visual feedback to users in the Webchat widget.
- **Usage Buffering**: `UsageBuffer` in `lib/subscription.ts` batches DB writes for usage tracking, significantly reducing DB load on high-frequency message processing.

### Optimization Areas
- **Next.js Rendering**: Ensure `force-dynamic` is only used where necessary to leverage Next.js static optimizations for landing pages and pricing views.
- **Widget Payload**: The Webchat widget bundle size must be monitored. *Recommendation*: Use code-splitting to load the UI only when the user clicks the chat bubble.

---

## 4. Performance Scaling Plan
| Component | Risk | Recommendation | Status |
| :--- | :--- | :--- | :--- |
| Database Connections | High | Deploy PgBouncer or Prisma Accelerate for pooling. | **PENDING** |
| List API Latency | High | Implement mandatory cursor-based pagination. | **IN PROGRESS** |
| Redis Memory | Medium | Configure AOF/RDB persistence and memory eviction. | **PENDING** |
| AI Queue | Medium | Move Lead Enrichment to a lower-priority queue. | **BACKLOG** |

**Performance Verdict**: The application is highly optimized for "Day 1" traffic (1-500 tenants). The architectural choices (Usage Buffering, Streaming AI, BullMQ) provide a clear path to scale, provided the pending infrastructure remediations (Pooling, Pagination) are completed.
