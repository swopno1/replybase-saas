# Proposal: Sentry Observability V2 (Advanced Tracing & Quota Management)

## Overview
ReplyBase currently has basic Sentry integration. This proposal outlines the transition to a high-fidelity observability stack that supports distributed tracing across background workers and sustainable quota management for the Free Tier.

## Business Value
- **Faster Debugging**: Trace a message from the customer's social channel through the AI engine to the CRM response.
- **Cost Efficiency**: Minimize Sentry quota usage by filtering out high-frequency polling and health checks.
- **Reliability**: Identify AI provider bottlenecks (latency/errors) with granular provider-specific tagging.

## Technical Considerations
1. **Trace Propagation**: BullMQ jobs must include `sentry-trace` and `baggage` metadata.
2. **AI Spans**: Wrap `aiFallback` calls in Sentry performance spans to measure duration and token efficiency.
3. **Dynamic Sampling**: Adjust sampling rates based on route criticality (100% for webhooks, 1% for CRM polling).

## Rollout Strategy
1. **Phase 1**: Update `lib/route-helpers.ts` and `sentry.server.config.ts` for consistent tagging and filtering.
2. **Phase 2**: Implement trace propagation in `lib/services/facebook-worker.ts` and `whatsapp-worker.ts`.
3. **Phase 3**: Enable AI-specific performance monitoring in `lib/ai-service.ts`.

## Risks
- **Quota Spikes**: Misconfigured sampling could exhaust the monthly quota in hours.
- **Performance Overhead**: Excessive span wrapping might introduce minor latency in the critical message path.
