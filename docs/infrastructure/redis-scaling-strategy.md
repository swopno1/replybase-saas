# Redis Scaling Strategy - ReplyBase

## 1. Startup Scale Analysis
Estimate of Redis necessity based on active tenant count (assuming single-instance DigitalOcean droplet deployment):

### At 10 Tenants
- **Usage:** Low webhook volume, occasional AI processing.
- **Need:** Minimal. Redis is mostly idle.
- **Infrastructure:** Self-hosted container is fine. Zero operational overhead.

### At 50 Tenants
- **Usage:** Increased concurrent social webhooks (WhatsApp/FB).
- **Need:** Moderate. BullMQ starts becoming essential to prevent dropped messages during AI spikes.
- **Infrastructure:** Self-hosted container remains viable. Monitor droplet swap pressure.

### At 100 Tenants
- **Usage:** High webhook volume, multiple concurrent AI worker threads.
- **Need:** **High**. Redis RAM usage will increase due to job data storage.
- **Infrastructure:** Start planning migration to external Redis. Evaluate Upstash (Serverless) or DigitalOcean Managed Redis to free up droplet RAM for Next.js.

### At 250 Tenants
- **Usage:** Sustained high-throughput messaging.
- **Need:** **Mission-Critical**.
- **Infrastructure:** **Mandatory external Redis.** This allows the application server to use its full RAM for request handling and worker concurrency.

## 2. Future Scaling Thresholds
Define when Redis becomes truly necessary:

| Metric | Threshold for Self-Hosted | Threshold for Managed Redis |
|--------|---------------------------|-----------------------------|
| Active Concurrent Tenants | < 100 | > 150 |
| Job Throughput | < 50 jobs/min | > 200 jobs/min |
| Webhook Volume | < 10k/day | > 50k/day |
| AI Concurrency | < 5 parallel tasks | > 15 parallel tasks |
| Droplet RAM Usage | < 75% | > 85% |

## 3. DigitalOcean + Coolify Optimization
- **Operational Simplicity:** Self-hosting inside Coolify is perfect for the current stage. It avoids managed service costs and complex networking.
- **Memory Optimization:**
    - Set `maxmemory` in Redis config (e.g., 256MB) on small droplets.
    - Use `allkeys-lru` eviction policy.
- **Reliability:** BullMQ's persistence in Redis is sufficient for early scale; backups of Redis are less critical than Postgres backups as job data is transient.
