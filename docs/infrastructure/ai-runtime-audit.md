# AI Processing Audit - ReplyBase

## Orchestration Strategy
ReplyBase uses a multi-provider strategy (`lib/ai-service.ts`) with the following priorities:
1. **Primary:** DigitalOcean AI Inference (OpenAI-compatible).
2. **Fallback:** OpenAI, Anthropic, Gemini.

## Bottlenecks & Risks

### 1. Cost Controllability (The "Runaway AI" Risk)
**Risk:** High.
**Finding:** While `incrementTenantUsage` tracks message counts, there is no hard circuit-breaker in the AI path that prevents a tenant from consuming thousands of tokens in a short loop (e.g., bot-to-bot interaction).
**Recommendation:** Implement a per-tenant daily token or message credit limit that blocks the `aiFallback` call if exceeded.

### 2. Failover UX Latency
**Risk:** Medium.
**Finding:** The `AbortController` timeout in `lib/ai-fallback.ts` is set to 15 seconds.
**Impact:** If the primary provider (DigitalOcean) is hanging, the user waits 15 seconds of silence before the system even attempts a fallback.
**Recommendation:** Reduce the primary timeout to 8 seconds. Most social/webchat users will abandon the session after 10 seconds of silence.

### 3. Redundant Context Fetching
**Finding:** `aiFallback` fetches 10-12 previous messages for every single AI turn.
**Impact:** This is efficient for small conversations, but for very long threads, fetching raw rows from `CrmMessage` and serializing them into strings adds unnecessary latency and DB load.
**Recommendation:** For "Scale" and "Business" plan tenants with high message volume, consider caching the "Summary" of the conversation in Redis/Postgres to reduce the required message history depth.

### 4. Non-Streaming Social Channels
**Finding:** Webchat supports streaming (`streamText`), but Facebook and WhatsApp workers wait for the entire AI response to complete before sending the reply.
**Impact:** Creates a high "Time to First Message" (TTFM) for social users.
**Recommendation:** Since Meta/WhatsApp APIs don't support streaming, the current "Wait & Send" approach is the only option, but we must optimize the "Intent Extraction" phase to be as fast as possible (e.g., using a smaller model like `llama-3-8b` for intent).

## Performance Highlights
- **Parallel Execution:** Intent extraction and history fetching are parallelized correctly using `Promise.all`.
- **Identity Stitching:** The system correctly handles cross-channel identity, ensuring the AI has context regardless of whether the user is on Webchat or WhatsApp.
