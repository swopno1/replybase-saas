# Facebook Latency & Reliability Audit (August 2026)

## 1. Issue: "No Reply" (Reliability)
**Root Cause:** Redis Connection Failures (ECONNREFUSED)
- **Technical Detail:** Production logs for service `srv-d7t519jbc2fs73dc18e0` show repeated `ECONNREFUSED` errors for `127.0.0.1:6379`.
- **Impact:** The system uses BullMQ for background message processing. When the connection to Redis fails, the `facebook-message` job cannot be enqueued or processed.
- **Reason:** `lib/config.ts` defaults to `localhost` if the `REDIS_URL` environment variable is not explicitly set or is misconfigured in the Render environment.

## 2. Issue: "Long Time" (Latency)
**Root Cause A: Sequential AI Processing**
- **Technical Detail:** In `lib/ai-fallback.ts`, the system performs a `generateObject` call for intent classification *before* starting the main `streamText` response.
- **Impact:** This effectively doubles the Round Trip Time (RTT) for the LLM, adding several seconds of delay.

**Root Cause B: Synchronous Profile Fetching**
- **Technical Detail:** `lib/services/facebook-worker.ts` performs a synchronous `fetch` to the Facebook Graph API to retrieve `first_name` and `last_name` before proceeding with the conversation logic.
- **Impact:** Any delay or rate-limiting on the Facebook side stalls the worker thread.

**Root Cause C: Artificial Typing Delays**
- **Technical Detail:** The worker implements a `typing_on` sender action followed by `waitForFlowDurationMs(Math.min(resp.durationMs, 3000))`.
- **Impact:** This adds up to 3 seconds of *mandatory* wait time per message segment, which contributes to the "steppy" and slow feel reported by users.

## Recommendations
1. **Infrastructure:** Ensure `REDIS_URL` is correctly set in Render environment variables and points to a managed Redis instance (e.g., Upstash or Render Redis).
2. **AI Optimization:** Parallelize or skip the intent classification step if latency is a priority, or use a faster "lite" model for the initial classification.
3. **Worker Optimization:** Cache Facebook profile data to avoid repeated API calls, or perform the fetch asynchronously after the initial reply.
4. **UX:** Reduce the maximum typing indicator duration from 3000ms to 1000ms-1500ms for a snappier feel.
