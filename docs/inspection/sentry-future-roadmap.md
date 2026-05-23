# Sentry Future Enterprise Roadmap

## Phase 1: Stable Polish (Current Focus)
- Multi-tenant tagging.
- AI provider instrumentation.
- BullMQ distributed tracing.
- Security hardening (PII scrubbing).

## Phase 2: Operational Maturity (Pro Tier)
- **Session Replay**: Enable for all paid tenants to debug complex UX issues in the Flow Builder.
- **Profiling**: Continuous profiling to identify CPU bottlenecks in message processing.
- **Cron Monitoring**: Monitor the reliability of `sync-plans` and cleanup jobs.

## Phase 3: Advanced Observability (Enterprise Tier)
- **Distributed Tracing**: Across multiple microservices or edge functions.
- **Alert Routing**: Route tenant-specific errors to dedicated support channels.
- **SLA Dashboards**: Build dashboards for AI response time and provider uptime.
- **Custom Metrics**: Track business KPIs (e.g., "Leads Captured") directly in Sentry.

## Phase 4: AI Quality Monitoring
- Integrate Sentry with AI evaluation frameworks to track "Hallucination Rate" or "Guardrail Failure Rate" as a performance metric.

---
