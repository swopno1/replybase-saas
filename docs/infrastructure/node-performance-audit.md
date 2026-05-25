# Node.js & Next.js Performance Audit - ReplyBase

## Overview
Inspection of the Next.js App Router applications, focusing on memory usage, concurrency, and responsiveness.

## Bottlenecks & Risks

### 1. The "Polling Tax" (High Server Load)
**Finding:** `app/(dashboard)/conversations/[conversationId]/page.tsx` uses a 5-second `setInterval` (`refreshConversation`) to fetch conversation data.
**Impact:**
- **Server Load:** Every open browser tab for an agent generates 12 full-page-data DB requests per minute. With 10 active agents, that's 120 complex queries/min just for idle monitoring.
- **UX:** Updates feel "steppy." Messages sent via social channels can take up to 5 seconds to appear for the agent.
- **CPU Waste:** Next.js must re-render the page/API response repeatedly even if no new messages exist.

### 2. In-Memory Usage Buffering (Data Loss Risk)
**Finding:** `lib/subscription.ts` uses a custom `UsageBuffer` class that batches updates in a `Map` and flushes every 10 seconds.
**Risk:**
- **Data Loss:** If the container restarts or crashes before the 10s flush, usage counts are lost. This impacts revenue (billing limits) and security (rate limiting).
- **Horizontal Scaling:** This pattern only works for single-instance deployments. In a multi-instance setup, each instance would have its own buffer, leading to inconsistent usage state.

### 3. L1 Cache Eviction Strategy
**Finding:** `TENANT_LIMITS_CACHE` in `lib/subscription.ts` implements a rudimentary "delete first key" strategy when the size exceeds 1000.
**Impact:** This is not a true LRU (Least Recently Used) cache. It could evict highly active tenants while keeping stale ones if the insertion order is unfavorable. This leads to non-deterministic DB pressure.

### 4. Event Loop Blocking in Workers
**Finding:** Workers process incoming messages sequentially after being picked up from BullMQ. While AI intent extraction is parallelized with history fetching, the actual worker concurrency (`concurrency: 5` or `10`) is handled by the single Node.js main thread.
**Impact:** During high-volume AI streaming, the Node.js event loop can experience "micro-stutters," increasing the TTFB (Time to First Byte) for legitimate dashboard users.

## Recommendations

1. **Server-Sent Events (SSE):** Replace the 5s polling in the CRM with SSE. This reduces DB load by >90% as the server only pushes data when a new message is actually saved to `CrmMessage`.
2. **Standardized Caching:** Replace manual Map caches with a production-grade LRU library (e.g., `lru-cache`) with a fixed memory footprint.
3. **Usage Persistence:** Move the `UsageBuffer` to Redis using `HINCRBY` instead of an in-memory Map. This ensures data persistence and supports horizontal scaling.
4. **Worker Concurrency Tuning:** Monitor Event Loop Lag using `perf_hooks`. If lag exceeds 50ms, reduce worker concurrency or isolate workers into their own process.
