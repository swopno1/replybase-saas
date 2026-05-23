# Sentry Performance Monitoring Strategy

## 1. High-Value Tracing
Focus performance monitoring on the "Critical Path" where latency directly impacts user experience or business revenue.

### Priority Routes
1. **Webchat Initialization**: Impact on lead conversion.
2. **AI Fallback Response**: Impact on perceived bot intelligence.
3. **CRM Message Feed**: Impact on agent productivity.
4. **Stripe Webhooks**: Impact on revenue integrity.

## 2. Distributed Tracing for Workers
Link the incoming webhook request to the BullMQ worker job:
1. Capture `sentry-trace` and `baggage` headers at the API level.
2. Pass these to the BullMQ job data.
3. Use `Sentry.continueTrace` inside the worker to maintain the span hierarchy.

## 3. Database Performance
Prisma middleware or extensions should be used to capture slow queries (> 200ms) as Sentry spans. This is critical for identifying N+1 issues in the CRM.

## 4. Frontend Bottlenecks
- **Hydration Monitoring**: Track hydration time for the complex Flow Builder and CRM views.
- **LCP/CLS**: Monitor core web vitals for the landing page and dashboard.

## 5. Quota Constraints
Performance units are consumed quickly.
- Disable auto-instrumentation for low-value internal APIs.
- Use "Parameterized Routes" (`/conversations/[id]`) to ensure Sentry groups transactions correctly.

---
