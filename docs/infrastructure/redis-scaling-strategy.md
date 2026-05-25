# Redis Scaling Strategy - ReplyBase

## 1. Dependency Classification

| Feature | Classification | Justification |
|---------|----------------|---------------|
| **BullMQ (Message Processing)** | **CRITICAL** | Essential for meeting social platform (Meta) webhook response time requirements (<200ms). |
| **BullMQ (Webhook Dispatcher)** | **IMPORTANT** | Provides reliability and retries for outbound notifications, but could be simplified if needed. |
| **Subscription Cache** | **OPTIONAL** | Purely a performance optimization to reduce Postgres load. |
| **Rate Limiting** | **PREMATURE** | Currently handles low traffic; in-memory fallback is sufficient for single-instance deployment. |

## 2. Startup Scale Analysis

Estimated Redis requirement based on tenant count (assuming single-instance DigitalOcean deployment):

### 10 Tenants
- **Redis Requirement:** **Minimal**.
- **Memory Pressure:** Very low (< 10MB).
- **Concurrency:** Negligible.
- **Assessment:** Self-hosted Redis container is fine, but technically overkill. BullMQ could be replaced by a simple `Promise.all` in many cases if latency wasn't an issue.

### 50 Tenants
- **Redis Requirement:** **Recommended**.
- **Memory Pressure:** Low (~50MB).
- **Concurrency:** Periodic bursts from social webhooks.
- **Assessment:** BullMQ becomes useful for handling bursty traffic from WhatsApp/Facebook without dropping messages.

### 100 Tenants
- **Redis Requirement:** **Necessary**.
- **Memory Pressure:** Moderate (~100-200MB).
- **Concurrency:** Multiple concurrent AI worker threads.
- **Assessment:** Redis provides the necessary backpressure mechanism. At this stage, monitoring RAM on the 500MB droplet becomes critical.

### 250 Tenants
- **Redis Requirement:** **External/Managed**.
- **Memory Pressure:** High (Potential to exceed 500MB limit).
- **Concurrency:** Sustained webhook volume.
- **Assessment:** Migration to managed Redis (e.g., Upstash or DigitalOcean Managed Redis) is required to free up RAM for the main Next.js application and background workers.

## 3. Scaling Thresholds

| Metric | Threshold for Managed Redis | Threshold for Horizontal Scaling |
|--------|-----------------------------|---------------------------------|
| Concurrent Tenants | 200 | 500 |
| Messages / Minute | 1,000 | 5,000 |
| Worker Concurrency | 10 | 25 |
| Droplet RAM Usage | > 85% | N/A |

## 4. DigitalOcean + Coolify Optimization

### Current State (Self-Hosted on Droplet)
- **Pros:** Zero additional cost, unified deployment, low latency (localhost).
- **Cons:** Shared RAM with Next.js (risk of OOM), manual backup management, no persistence guarantees if container restarts.

### Recommendation
**DEFER managed Redis.**
- Self-hosted Redis is sustainable until ReplyBase reaches ~100-150 active tenants.
- **Immediate Action:** Optimize Redis RAM usage via `maxmemory` settings in the container (limit to 256MB) and use `allkeys-lru` eviction policy.
