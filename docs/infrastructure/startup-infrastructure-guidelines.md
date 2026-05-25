# Startup Infrastructure Guidelines - ReplyBase

## Philosophy: Start Small, Scale Later

At the current stage (Early SaaS / Startup), the infrastructure priority is **reliability over scalability**. We favor simplicity and low cost.

### 1. Minimal Redis Footprint
- **Don't over-cache:** Only cache when database load becomes a measurable bottleneck.
- **Single Source of Truth:** Prefer Postgres as the primary data store for all persistent state.
- **Background Jobs:** Use BullMQ only for tasks that *must* be asynchronous (e.g., social webhooks, slow AI tasks). Avoid using it for every small task.

### 2. Operational Simplicity
- **Managed Services (Deferred):** Avoid managed Redis, managed Kafka, or managed Elasticsearch until the operational burden of self-hosting exceeds the cost of the service.
- **Deployment:** Stick to Coolify on a single droplet for as long as possible. Horizontal scaling is a "good problem" to have in the future.

### 3. RAM Management
- The primary constraint on small droplets (DigitalOcean) is RAM.
- **Node.js:** Monitor `--max-old-space-size`.
- **Redis:** Always set a `maxmemory` limit (e.g., 256MB) to prevent the Redis container from starving the main application.

### 4. Recommendation Strategy

**FINAL RECOMMENDATION: OPTION B (Reduce Usage) + OPTION D (Move External Later).**

- **Current Action:** Maintain self-hosted Redis for BullMQ.
- **Optimization:** Move Rate Limiting to in-memory only (since we are on a single instance).
- **Optimization:** Review Subscription caching; if Postgres load is low, consider disabling Redis caching to save RAM.
- **Future:** Move to managed Redis once tenant count hits 150-200.

---

> **IMPORTANT NOTE:**
> Redis scaling and managed Redis migration are intentionally DEFERRED until ReplyBase reaches meaningful production load (~100+ active concurrent tenants). AI agents should focus on optimizing current resource usage rather than suggesting enterprise-grade migrations.
