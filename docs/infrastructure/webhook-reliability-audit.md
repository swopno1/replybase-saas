# Webhook & Queue Reliability Audit - ReplyBase

## Reliability Flow
1. **Ingestion:** `app/api/*/webhook/route.ts` validates signature and saves raw event to `WebhookLog`.
2. **Deduplication:** `WebhookLog` has a unique constraint on `(source, event)` to catch retries from Meta/Telegram.
3. **Queueing:** Job is pushed to BullMQ (`message-processing`).
4. **Processing:** Workers in `lib/services/` execute the logic (Flow Engine + AI Fallback).

## Identified Risks

### 1. The "BullMQ Storm" (Retry Amplification)
**Risk:** Medium.
**Finding:** Jobs have `attempts: 3` or `5` with exponential backoff.
**Impact:** If the primary AI provider is down, 100 queued messages will all fail and enter a retry cycle. When they all retry simultaneously, they will hit the rate limits of the fallback provider immediately, causing a cascading failure.
**Recommendation:** Implement a simple "Circuit Breaker" in `lib/ai-service.ts` that temporarily pauses AI processing if the failure rate exceeds 50% over a 1-minute window.

### 2. Dead-Letter Silence
**Risk:** Medium.
**Finding:** `removeOnFail: false` is used in some queues (`message-processing`).
**Impact:** Jobs that fail permanently (e.g., due to an invalid Meta token) stay in Redis forever. This slowly leaks memory and hides systemic issues from the dashboard.
**Recommendation:**
- Set `removeOnFail: 500` (keep only recent failures).
- Implement a health check or Telegram alert for "Failed Jobs Count > 20".

### 3. Outbound Webhook Latency
**Finding:** `dispatchWebhook` (`lib/services/webhook-dispatcher.ts`) uses a separate queue with `concurrency: 10`.
**Risk:** Low.
**Observation:** This is a well-implemented separation of concerns. External URL slowness will not block the core messaging pipeline.

### 4. Sequential Worker Execution
**Finding:** Many worker steps (Lead Extraction, Milestone Recording, Usage Increment) are performed sequentially or as non-awaited promises within the worker loop.
**Optimization:** While the current use of non-awaited promises (`.catch()`) is good for speed, it makes debugging harder if they fail silently.
**Recommendation:** Move these "Side Effect" tasks to their own specialized BullMQ queues (e.g., `lead-sync-queue`) to ensure they are also reliable and observable.

## Reliability Successes
- **Signature Verification:** Properly implemented for Facebook, WhatsApp (Twilio & Meta), and implicitly for Telegram via secret token.
- **Idempotency:** The `WebhookLog` unique constraint strategy is a best-practice for high-volume webhook ingestion.
