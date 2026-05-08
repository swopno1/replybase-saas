# Performance and Scalability Report: ReplyBase SaaS

## 1. Database Layer
### Current Performance
- **Prisma usage**: Generally efficient.
- **Indexing**: Core entities (Leads, Conversations, Messages) have appropriate indices on `tenantId`, `createdAt`, and `contactId`.
- **N+1 Queries**: A potential bottleneck was identified in WhatsApp status logging and was successfully refactored to use `createMany`.

### Scalability Bottlenecks
- **Unbounded findMany**: Some routes (e.g., `app/api/conversations/route.ts`) need strict pagination (`take`, `skip`) to handle tenants with 10k+ conversations.
- **Large Json fields**: The `insights` field on `Lead` and `context` on `Bot` could grow large. Monitoring database size/growth per tenant is recommended.

---

## 2. Background Processing (BullMQ)
### Current Performance
- **Concurrency**: Default set to 5.
- **Worker Separation**: Infrastructure supports running workers on dedicated compute nodes, which is vital for high-volume messaging.

### Scalability Recommendations
- **Job Retention**: Set `removeOnComplete: { age: 3600, count: 1000 }` to prevent Redis memory bloat from old job data.
- **Retry Strategy**: Ensure exponential backoff is configured for outbound webhooks (`lib/services/webhook-dispatcher.ts`) to handle transient 3rd-party failures.

---

## 3. Application Layer (Next.js)
### Performance Analysis
- **Streaming**: AI responses are streamed (`toDataStreamResponse`), significantly improving the Time-to-First-Byte for end users.
- **Caching**: Dual-layer caching for plan limits reduces DB load for every authenticated request.

### Optimization Areas
- **Bundle Size**: Monitor the size of the Webchat widget (`public/embed/replybase-webchat.js`). It should be kept minimal (< 50KB gzipped) to avoid affecting host site performance.
- **Serverless Cold Starts**: If deployed to Vercel/Lambda, the initial connection to Prisma and Redis adds 500ms+ latency. Using a connection pooler and warming strategies is advised.

---

## 4. Key Metrics for Production
- **DB Connection Count**: Monitor via `pg_stat_activity`.
- **Redis Memory Usage**: Monitor to ensure eviction policies (`allkeys-lru`) aren't killing BullMQ data.
- **AI Latency**: P95 response time for `aiFallback` calls.
- **Webhook Success Rate**: Percentage of successfully delivered outbound lead webhooks.
