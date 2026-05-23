# Sentry Observability & Instrumentation Audit - ReplyBase (August 2026)

## 1. Executive Summary
The current Sentry implementation provides basic error tracking but lacks the depth required for a high-stakes, multi-tenant AI platform. Crucial context (tenants, AI providers, workers) is missing, and the configuration carries significant privacy risks.

## 2. Current Implementation Status
- **SDK Version**: `@sentry/nextjs` ^10.53.1 (Latest major version).
- **Initialization**: Split across `sentry.server.config.ts`, `sentry.edge.config.ts`, and a non-standard `instrumentation-client.ts`.
- **Instrumentation**: Uses Next.js App Router hooks via `instrumentation.ts`.
- **Tunneling**: Correctly configured to `/monitoring` to bypass ad-blockers.

## 3. Critical Gaps & Risks
- **Multi-Tenant Blindness**: Errors do not carry `tenant_id`, making it impossible to quickly isolate issues affecting specific customers.
- **AI Observability Gap**: No tagging for AI providers (DigitalOcean, OpenAI, Anthropic) or specific AI tasks (chat, analysis, fallback).
- **Background Worker Visibility**: BullMQ jobs are not linked to the originating webhooks, breaking the distributed trace.
- **Privacy Leakage**: `sendDefaultPii: true` is enabled, potentially sending sensitive user emails or IP addresses to Sentry.
- **Local Variable Exposure**: `includeLocalVariables: true` may capture sensitive data in stack traces.

## 4. Architectural Evaluation
### Client-Side
The absence of a standard `sentry.client.config.ts` and reliance on `instrumentation-client.ts` is unconventional for Next.js 15+ and may lead to missed client-side hydration or rendering errors.

### Server-Side
Server Actions and API Routes are instrumented, but lack breadcrumb enrichment for database operations beyond standard Prisma logging.

### Edge Runtime
Edge config is present but minimal; requires verification for Facebook/WhatsApp webhook edge handling.

## 5. Immediate Recommendations
1. **Standardize Client Config**: Rename `instrumentation-client.ts` to `sentry.client.config.ts` or ensure it's correctly imported by Next.js.
2. **Context Enrichment**: Inject `tenant_id` and `user_id` into the Sentry scope within the `withAuthAndTenant` wrapper.
3. **AI Metadata**: Add tags for provider, model, and task in `getAiModel`.
4. **Security Hardening**: Disable `sendDefaultPii` and implement an allow-list for sensitive tags.

---
