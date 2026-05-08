# Performance & Scalability Report

**Date:** 2026-05-08
**Status:** **READY WITH CAUTIONS**
**Auditor:** Performance Engineer

## 1. Database Query Efficiency
*   **Strengths:** Implementing `UsageBuffer` reduces the write amplification on the `Subscription` table, which is critical since message processing is high-frequency.
*   **Risks (N+1 Queries):** Dashboard tables that list `Conversations` and eagerly map `Messages` or `Contacts` without proper Prisma `include` constraints can cause N+1 query floods.
*   **Verdict:** Review the dashboard API routes (e.g., `/api/conversations`) and ensure pagination is strictly enforced using `take` and `skip`, and relations are fetched via `include` rather than mapped sequentially.

## 2. Worker Queue & Bottlenecks
*   **Strengths:** BullMQ adoption prevents Webhook API timeouts. 
*   **Risks:** If the AI provider (OpenAI) experiences high latency, the worker queue will back up. Since AI generation is synchronous within the worker job, 10 slow jobs will block 10 worker threads.
*   **Verdict:** Implement concurrency limits per-tenant within BullMQ to prevent one viral tenant from consuming all worker threads. Use `concurrency: 50` on the worker instantiation to scale throughput.

## 3. Serverless vs. Long-Running Processing
*   **Risks:** Next.js API routes have an execution limit on Vercel (10s on Hobby, 60s on Pro). If deployed to Vercel, the background workers initialized via `instrumentation.ts` will freeze or terminate unexpectedly between requests.
*   **Verdict:** If hosting on Vercel, offload long-running tasks to Inngest or Upstash QStash. If hosting on a DigitalOcean Droplet / Coolify (which seems to be the case), the current BullMQ architecture is perfectly fine but requires standard PM2/Docker restart policies.
