# Startup Scaling Thresholds - ReplyBase

Pragmatic infrastructure guidelines for ReplyBase as it scales from 0 to 500 tenants on DigitalOcean.

## Phase 1: The Lean Startup (0 - 50 Tenants)
**Configuration:** 1x 2vCPU / 4GB RAM Droplet (Standard Intel/AMD).
- **Architecture:** Monolithic (Next.js + Workers in one process), Self-hosted Postgres & Redis.
- **Key Risks:** Log growth, single point of failure.
- **Recommended Actions:**
  - Implement 30-day log retention.
  - Set Redis `maxmemory` limit.
  - Reduce Postgres pool size to 15-20.

## Phase 2: Early Growth (50 - 150 Tenants)
**Configuration:** 1x 2vCPU / 4GB RAM (Optimize for CPU).
- **Architecture:** Monolithic process.
- **Key Risks:** CRM response latency, DB connection exhaustion.
- **Recommended Actions:**
  - **MANDATORY:** Migrate CRM from 5s polling to Server-Sent Events (SSE).
  - Implement per-tenant daily AI credit limits.
  - Move `UsageBuffer` from in-memory Map to Redis.

## Phase 3: Scaling Velocity (150 - 300 Tenants)
**Configuration:** **Upgrade Droplet to 4vCPU / 8GB RAM.**
- **Architecture:** **Isolate Workers.** Separate the BullMQ worker process from the Next.js web process (Split Docker services).
- **Key Risks:** Node.js event loop lag, disk I/O bottlenecks.
- **Recommended Actions:**
  - Deploy PgBouncer for connection pooling.
  - Use DigitalOcean Volumes for Postgres storage (easier resizing).
  - Enable 24/7 monitoring for Redis memory and Queue depth.

## Phase 4: Established SaaS (300 - 500 Tenants)
**Configuration:** **Move Database to Managed Postgres.**
- **Architecture:** Distributed Web + Distributed Workers.
- **Key Risks:** Database contention, maintenance windows.
- **Recommended Actions:**
  - Migrate Postgres to DigitalOcean Managed Database (HA cluster).
  - Consider moving Redis to Upstash or Managed Redis.
  - Implement Horizontal Scaling for the Web layer (Multiple containers behind a load balancer).

## Summary Table

| Metric | Startup (0-50) | Growth (50-250) | Scale (250+) |
|:---|:---|:---|:---|
| **RAM Requirement** | 4 GB | 4 GB - 8 GB | 8 GB - 16 GB |
| **Postgres** | Self-hosted | Self-hosted + Tuning | Managed (High Availability) |
| **Redis** | Self-hosted (256MB) | Self-hosted (512MB) | Managed |
| **CRM Sync** | 5s Polling | SSE (Real-time) | SSE / WebSockets |
| **Workers** | Process-integrated | Process-integrated | Isolated Services |
