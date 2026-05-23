# Sentry Free Plan Optimization Strategy

## 1. Quota Management Philosophy
On the Sentry Free Plan, signal-to-noise ratio is everything. We must prioritize actionable production crashes over high-volume, low-value telemetry.

## 2. Event Filtering (Error Budget)
### Ignore List
Recommendation to ignore common, non-breaking browser errors in client-side config:
- `ResizeObserver loop limit exceeded`
- `Script error.` (Cross-origin issues)
- `Non-error promise rejection`

### Inbound Filtering
Use Sentry Dashboard to filter:
- Web crawlers and bot traffic.
- Legacy browser errors (e.g., IE11).
- Health check endpoints (`/api/health`).

## 3. Transaction & Trace Optimization
### Sampling Strategy
Current sampling is 10% in production. This is likely too high for a free plan if traffic scales.
- **Target**: 2% (0.02) for general API routes.
- **Exception**: 100% for critical paths like `/api/billing/webhook` or `/api/facebook/webhook`.

### Manual Transaction Control
Use `beforeSendTransaction` to drop:
- Successful `GET /api/health` calls.
- Static asset requests (if any bypass Next.js optimization).
- Rapid polling requests (e.g., CRM 5s refresh).

## 4. Quota-Conscious Features
- **Session Replay**: Keep at 0.1% (1 in 1000) for general use, but 100% on error. This provides the most value without hitting limits instantly.
- **Profiling**: Disable until specific performance regressions are identified.

## 5. Action Plan
1. Update `tracesSampleRate` to a dynamic function based on the route path.
2. Implement a global `beforeSend` hook to de-duplicate known issues.
3. Configure "Delete and Discard" for legacy errors in the Sentry UI.

---
