# Redis Post-Plausible Review - ReplyBase

## Context
The removal of Plausible Analytics has reclaimed significant RAM (~400MB-600MB), making the self-hosting of Redis on the 4GB RAM Droplet much safer and more efficient.

## Usage Audit
- **BullMQ (Critical):** Manages all background social messaging (Facebook, WhatsApp, Telegram). This is the primary driver of Redis usage.
- **L2 Cache (Important):** Stores tenant subscription limits to reduce DB load (`lib/subscription.ts`).
- **Rate Limiting (Optional):** Used for webchat rate limiting with an in-memory fallback.

## Identified Risks & Optimizations

### 1. Unbounded Memory Growth
**Risk:** High.
**Finding:** Redis defaults to using all available system memory. Without a limit, a surge in queued jobs could cause Redis to consume RAM required by the Next.js process, leading to OOM (Out of Memory) crashes.
**Recommendation:**
- Set `maxmemory 256mb` in the Redis container.
- Set `maxmemory-policy allkeys-lru` to ensure old cache keys or completed jobs are evicted first.

### 2. Job Retention Policy
**Risk:** Medium.
**Finding:** Current BullMQ configurations in `lib/queue.ts` and `lib/services/webhook-dispatcher.ts` keep up to 1000 completed jobs and 5000 failed jobs.
**Impact:** These jobs consume significant memory in Redis for metadata.
**Recommendation:**
- Reduce `removeOnComplete` to 100.
- Reduce `removeOnFail` to 500.

### 3. Connection Robustness
**Finding:** `lib/redis.ts` uses `maxRetriesPerRequest: null`. This is correctly configured for BullMQ compatibility.
**Observation:** The retry strategy in production stops after 3 attempts. This might be too aggressive for a self-hosted instance that might experience micro-outages during heavy I/O.
**Recommendation:** Increase `retryStrategy` attempts to 10 with a jittered exponential backoff.

## Scaling Decision: Managed vs. Self-Hosted
**Status:** **Remain Self-Hosted.**
**Justification:**
1. **Cost:** Managed Redis adds $15-$30/mo in overhead.
2. **Performance:** Self-hosted Redis on the same Droplet has near-zero network latency.
3. **Complexity:** With Plausible gone, the 4GB Droplet has ample headroom for a 256MB Redis instance.
**Scaling Threshold:** Re-evaluate moving to Managed Redis (e.g., Upstash) when the system reaches 150+ concurrent active tenants or requires horizontal scaling.
