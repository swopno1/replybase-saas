# Infrastructure Audit - ReplyBase (Post-Plausible Removal)

## Overview
This audit evaluates the current infrastructure of ReplyBase on a DigitalOcean Droplet (2 vCPU, 4GB RAM) managed by Coolify, following the removal of Plausible Analytics.

## Service Topology
- **Web App + Workers:** Single Next.js application running in Docker. Both the web server and BullMQ workers share the same process via `instrumentation.ts`.
- **Database:** Self-hosted PostgreSQL (Docker).
- **Queue/Cache:** Self-hosted Redis (Docker).

## Critical Risks

### 1. Monolithic Process Memory Pressure
**Risk:** High.
**Finding:** `instrumentation.ts` initializes both `setupWorker()` (Message Queue) and `setupWebhookWorker()` (Outbound Webhooks) within the Next.js runtime.
**Impact:** During high webhook volume (e.g., WhatsApp/Facebook bursts), the worker threads will compete with the Next.js API/Frontend for the 4GB RAM Droplet's resources. If the process exceeds its heap limit, the entire service (Frontend + Workers) crashes.

### 2. Disk Space Exhaustion (Log Bloat)
**Risk:** Medium-High.
**Finding:** The `WebhookLog` and `ExecutionLog` tables store raw JSON payloads. There is no automated cleanup logic in the codebase for these tables.
**Impact:** 120GB disk will eventually fill. As the database grows, backup times increase and query performance on these tables will degrade significantly.

### 3. Startup Blocking & Health Check Failures
**Risk:** Low-Medium.
**Finding:** The `Dockerfile` runs `npx prisma migrate deploy` in the `CMD`.
**Impact:** If a migration takes longer than the 30s `start-period` in the HEALTHCHECK, Coolify will mark the container as unhealthy and restart it, potentially leading to a restart loop during schema-heavy updates.

## Identified Inefficiencies

- **Oversized Postgres Pool:** Currently set to 50 connections (`lib/prisma.ts`). For a 4GB RAM Droplet sharing resources with Redis and Node.js, this is excessive (50 connections \approx 500MB+ RAM overhead).
- **Unbounded Redis Memory:** Redis is likely running with default settings. Without a `maxmemory` cap, Redis could consume all available RAM under load, triggering the OOM killer on the Next.js process.

## Recommendations

1. **Isolation:** Set a roadmap to split BullMQ workers into a separate Docker container service when the tenant count exceeds 100.
2. **Hardening:** Explicitly set `maxmemory 256mb` and `maxmemory-policy allkeys-lru` in the Redis configuration.
3. **Log Retention:** Implement a 30-day retention policy for `WebhookLog` and `ExecutionLog`.
4. **Boot Optimization:** Move migrations to a separate "Pre-deploy" phase or use a more resilient migration strategy that doesn't block the primary process health check.
