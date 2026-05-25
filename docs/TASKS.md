# ReplyBase Master Task List - Operational Intelligence Hub

## 1. Core Stability, Performance & Security

- **Task 001**
  - Priority: HIGH
  - Status: DECLINED
  - Category: Performance/Database
  - Severity: HIGH
  - Issue: Dashboard Metrics Latency.
  - Root Cause: Real-time aggregation of dashboard stats (Lead counts, Conversion volume) are computed on the fly from the DB.
  - Business Impact: Significant improvement in dashboard load times and reduction in DB CPU usage during peak hours.
  - Objective: Implement Redis-based caching for all dashboard metric components.
  - Detailed Instructions: 1. Wrap data queries in a caching utility. 2. Use `dashboard:stats:[tenantId]` keys with a 300s TTL. 3. Implement event-driven cache invalidation when leads/messages are created.
  - Expected Deliverables: Cached metrics layer and invalidation logic.
  - Dependencies: Redis infrastructure.
  - Notes: Declined on 2026-05-21. Dashboard metrics queries are already optimized indexed reads (e.g. counts, findFirst lookups) rather than heavy aggregations. Adding Redis cache introduces cache-staleness risks and invalidation overhead across multiple API routes and workers, with no significant performance/load improvements.
  - Rollout Risk: MEDIUM.

- **Task 004**
  - Priority: HIGH
  - Status: DECLINED
  - Category: Infrastructure
  - Severity: CRITICAL
  - Issue: Automated DB & Redis Backups.
  - Root Cause: Lack of automated disaster recovery orchestration.
  - Business Impact: Risk of permanent data loss in case of infrastructure failure.
  - Objective: Set up automated S3/GCS backups for PostgreSQL and Redis persistence.
  - Detailed Instructions: 1. Configure pg_dump cron job. 2. Configure Redis RDB/AOF snapshots. 3. Upload to secure cloud storage with 30-day retention.
  - Expected Deliverables: Backup automation scripts and verification.
  - Dependencies: Cloud storage credentials.
  - Notes: Declined on 2026-05-21. DB and Redis backups are infrastructure-level configurations (e.g., managed AWS RDS or GCP Cloud SQL snapshots) and cannot be reliably run as local cron jobs in the app's lightweight node container without exposing security vulnerabilities, running out of memory, or conflicting with the container's main runtime process.
  - Rollout Risk: LOW.

- **Task 031**
  - Priority: MEDIUM
  - Status: DEFERRED
  - Category: Observability
  - Severity: MEDIUM
  - Issue: Admin Dashboard: Real-time Queue & AI Monitoring.
  - Root Cause: Admins lack visibility into background worker health and AI latency.
  - Business Impact: Faster incident detection and provider performance tracking.
  - Objective: Create an observability dashboard in the Admin suite.
  - Detailed Instructions: 1. Create `/api/admin/metrics` to expose BullMQ and AI stats. 2. Build a "System Health" tab in the Admin UI with Recharts.
  - Expected Deliverables: Real-time health dashboard for admins.
  - Dependencies: BullMQ.
  - Notes: Deferred on 2026-05-22. The backend API (`GET /api/admin/metrics`) was completed in Task 026, exposing queue sizes and AI latency percentiles. The remaining work is a frontend-only Recharts dashboard page. Deferred as a standalone UI feature ticket — the API foundation is production-ready and can be consumed by any monitoring tool (Grafana, DataDog) in the interim.
  - Rollout Risk: LOW.

- **Task 033**
  - Priority: MEDIUM
  - Status: DECLINED
  - Category: Performance
  - Severity: LOW
  - Issue: CRM Real-time Polling Latency.
  - Root Cause: `ConversationPage` uses 5-second interval polling for message updates.
  - Business Impact: Sub-optimal "live" feel; increased server load on high-concurrency CRM usage.
  - Objective: Transition CRM to WebSockets or SSE for real-time updates.
  - Detailed Instructions: 1. Implement a WebSocket/SSE server (e.g., using Socket.io or native SSE). 2. Update `ConversationPage` to subscribe to conversation-specific events. Verified `refreshConversation` is called via `window.setInterval` every 5000ms.
  - Expected Deliverables: Real-time "Instant" CRM updates.
  - Dependencies: WebSocket infrastructure.
  - Notes: Declined on 2026-05-22. Requires a persistent WebSocket/SSE server that runs alongside the Next.js serverless deployment. The current Vercel-based deployment model does not support long-lived WebSocket connections natively. This task requires an infrastructure migration (e.g., dedicated Node.js server, Ably/Pusher integration, or Vercel Edge Config with SSE) that is outside the scope of this codebase sweep. The existing 5-second polling is functional and adequate for current user volumes.
  - Rollout Risk: MEDIUM.

- **Task 039**
  - Priority: MEDIUM
  - Status: COMPLETED
  - Category: Observability
  - Severity: MEDIUM
  - Issue: Basic vs Deep Health Checks.
  - Root Cause: `/api/health` only performed basic uptime checks without verifying dependency connectivity.
  - Business Impact: Improved incident detection and platform reliability.
  - Objective: Implement deep health checks for Database and Redis.
  - Detailed Instructions: 1. Implement `prisma.$queryRaw` check. 2. Implement `redis.ping()` check. 3. Return 503 if any dependency fails.
  - Expected Deliverables: Enhanced `/api/health` endpoint.
  - Dependencies: Prisma, Redis.
  - Notes: Completed in August 2026. Endpoint verified to perform deep dependency pings.
  - Rollout Risk: LOW.

- **Task 041**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Performance/Engineering
  - Severity: MEDIUM
  - Issue: Sequential Database Writes in Webchat Engine.
  - Root Cause: `app/api/webchat/message/route.ts` performs multiple sequential Prisma calls (`idempotencyKey.create`, `crmMessage.create`, `crmMessage.createMany`) instead of using batching or transactions where appropriate.
  - Business Impact: Increased API response latency for webchat users; potential for database connection saturation during message bursts.
  - Objective: Optimize database write path in the webchat message handler.
  - Detailed Instructions: 1. Consolidate sequential writes (`idempotencyKey.create`, `crmMessage.create`, and `crmMessage.createMany`) into a `prisma.$transaction`. 2. Ensure `resolveWebchatVisitorSession` and `webChatEvent.create` (for shadow promotions) are also included in transaction context where safe.
  - Expected Deliverables: Streamlined message ingestion pipeline.
  - Dependencies: Prisma.
  - Notes: Identified during August 2026 inspection. Sequential writes in the webchat API contribute to higher latency and connection holding time.
  - Rollout Risk: LOW.

- **Task 042**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Performance/UX
  - Severity: MEDIUM
  - Issue: CRM High-Frequency Polling.
  - Root Cause: `app/(dashboard)/conversations/[conversationId]/page.tsx` uses 5-second interval polling for the entire conversation payload.
  - Business Impact: Sub-optimal "live" feel; unnecessary server load and database pressure at scale.
  - Objective: Transition CRM to event-driven updates (WebSockets/SSE).
  - Detailed Instructions: 1. Implement SSE or WebSocket support for conversation-specific events. 2. Replace polling with real-time subscriptions in the CRM UI.
  - Expected Deliverables: Real-time "Instant" CRM updates.
  - Dependencies: Redis (for pub/sub), SSE/WebSocket infrastructure.
  - Notes: Identified during August 2026 inspection. The current 5s polling is a placeholder for a truly real-time event-driven architecture.
  - Rollout Risk: MEDIUM.

- **Task 043**
  - Priority: HIGH
  - Status: PENDING
  - Category: Security/Multi-tenancy
  - Severity: HIGH
  - Issue: Residual Manual Scoping in Workers and Export API.
  - Root Cause: `lib/services/facebook-worker.ts` uses global `prisma` with manual filters. `app/api/user/data-export/route.ts` uses legacy `getServerSession` and manual `tenantId` lookups.
  - Business Impact: Elevated risk of cross-tenant data leaks (IDOR) if manual filters are misconfigured during future maintenance.
  - Objective: Standardize background workers and export utilities to use `getTenantPrisma` and `withAuthAndTenant`.
  - Detailed Instructions:
    1. In `lib/services/facebook-worker.ts`, initialize `const db = getTenantPrisma(tenantId)` after `facebookPage` lookup and replace all `prisma` calls with `db`.
    2. In `app/api/user/data-export/route.ts`, refactor `GET` handler to use `withAuthAndTenant`. Move admin-only onboarding export logic into a separate `withAdmin` guarded block or handle within the scoped context if appropriate.
    3. Audit and refactor `app/api/flows/`, `app/api/tenant/`, and `app/api/facebook/` routes identified as still using manual `getServerSession`.
  - Expected Deliverables: Hardened tenant isolation for background and data utility layers.
  - Dependencies: `getTenantPrisma`, `withAuthAndTenant`.
  - Notes: Identified during August 2026 inspection. Facebook worker and Data Export API remain as legacy outliers in the standardized scoping architecture.
  - Rollout Risk: LOW.

- **Task 044**
  - Priority: HIGH
  - Status: PENDING
  - Category: Observability
  - Quota Impact: LOW
  - Complexity: MEDIUM
  - Issue: Missing Multi-Tenant Visibility in Sentry.
  - Root Cause: Sentry scope is not enriched with tenant or user metadata in API routes or workers.
  - Business Impact: Debugging tenant-specific failures is slow and requires manual log correlation.
  - Objective: Inject tenant_id and user_id into all server-side Sentry events.
  - Detailed Instructions: 1. Update `withAuthAndTenant` in `lib/route-helpers.ts` to call `Sentry.setUser()` and `Sentry.setTag("tenant_id", ...)`. 2. Ensure worker jobs in `lib/queue.ts` also set the tenant tag.
  - Expected Deliverables: Sentry errors tagged with tenant_id and user_id.
  - Dependencies: Sentry SDK.
  - Notes: Complements Phase 4 observability.
  - Rollout Risk: LOW.

- **Task 045**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Observability
  - Quota Impact: LOW
  - Complexity: MEDIUM
  - Issue: Lack of AI Provider Instrumentation.
  - Root Cause: AI SDK calls are not traced or tagged with provider/task metadata.
  - Business Impact: Difficult to monitor AI reliability and latency across different providers (DigitalOcean vs OpenAI).
  - Objective: Add AI-specific tagging and spans to Sentry.
  - Detailed Instructions: 1. Update `getAiModel` in `lib/ai-service.ts` to set tags for `ai.provider`, `ai.model`, and `ai.task`. 2. Wrap AI invocations in Sentry spans for performance monitoring.
  - Expected Deliverables: Granular AI performance and error tracking.
  - Dependencies: Sentry SDK, AI Service.
  - Notes: Critical for AI performance monitoring.
  - Rollout Risk: LOW.

- **Task 046**
  - Priority: HIGH
  - Status: PENDING
  - Category: Security
  - Quota Impact: NONE
  - Complexity: LOW
  - Issue: PII Leakage Risk in Sentry.
  - Root Cause: `sendDefaultPii` and `includeLocalVariables` are enabled in Sentry config.
  - Business Impact: Potential exposure of sensitive user data or API keys in monitoring logs.
  - Objective: Harden Sentry privacy settings and implement sanitization.
  - Detailed Instructions: 1. Set `sendDefaultPii: false` in all Sentry config files. 2. Implement `beforeSend` hooks to scrub secrets (Stripe, AI keys) from breadcrumbs and payloads.
  - Expected Deliverables: Privacy-safe observability implementation.
  - Dependencies: Sentry SDK.
  - Notes: Security requirement.
  - Rollout Risk: LOW.

- **Task 047**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Observability
  - Quota Impact: MEDIUM
  - Complexity: MEDIUM
  - Issue: Broken Distributed Tracing for Background Workers.
  - Root Cause: BullMQ workers do not inherit the Sentry trace context from the originating webhook or user request.
  - Business Impact: Inability to trace a message from "Ingress Webhook" to "AI Response" to "Provider Dispatch".
  - Objective: Implement trace propagation across the BullMQ queue.
  - Detailed Instructions: 1. Capture `sentry-trace` and `baggage` headers in webhook routes. 2. Pass these to BullMQ job data. 3. Use `Sentry.continueTrace` in worker processing loops.
  - Expected Deliverables: End-to-end distributed traces in Sentry.
  - Dependencies: BullMQ, Sentry SDK.
  - Notes: Essential for Phase 4 scale.
  - Rollout Risk: MEDIUM.

- **Task 048**
  - Priority: LOW
  - Status: PENDING
  - Category: Observability
  - Quota Impact: HIGH
  - Complexity: LOW
  - Issue: Sentry Quota Waste in Production.
  - Root Cause: 10% sampling rate and lack of inbound filtering for health checks and rapid polling.
  - Business Impact: Free quota exhaustion, leading to blind spots during actual outages.
  - Objective: Optimize sampling and implement inbound filtering.
  - Detailed Instructions: 1. Implement dynamic sampling in `sentry.server.config.ts`. 2. Filter out `/api/health` and CRM polling requests from transaction tracking.
  - Expected Deliverables: Sustainable quota usage on Sentry Free Plan.
  - Dependencies: Sentry SDK.
  - Notes: Sustainable observability strategy.
  - Rollout Risk: LOW.

- **Task 049**
  - Priority: HIGH
  - Status: COMPLETED
  - Category: Subscription & Billing
  - Severity: HIGH
  - Issue: Legacy pricing model alignment and channel connect gating leakages.
  - Root Cause: Historical jump between Starter (£29) and Pro (£89) was too large. Gating verification in separate Facebook/WhatsApp/Telegram bot connection routes checked channel count limit only, bypassing plan allowed types.
  - Business Impact: Improved pricing conversion with a Grow (£49) plan. Hardened channel connection endpoints to prevent quota and channel type leakages.
  - Objective: Complete normalization of Price IDs, auto-apply FOUNDING50 for annual billing, and enforce channel type validation on all channel connect paths.
  - Detailed Instructions: 1. Update `lib/plans.ts` and `lib/stripe.ts` with new tiers and yearly price options. 2. Add `checkChannelLimitWithType` validation inside facebook, telegram, and whatsapp connect/status routes. 3. Auto-apply active Stripe promo codes matching `FOUNDING50` on checkout.
  - Expected Deliverables: Restructured pricing plans, type-gated connect routes, annual billing checkout validation, and comprehensive migration architecture documents.
  - Dependencies: Stripe API.
  - Notes: Completed on 2026-05-23. Verified all 481 unit/integration tests successfully.
  - Rollout Risk: LOW.

## 2. Product & Feature Expansion

- **Task 006**
  - Priority: LOW
  - Status: DEFERRED
  - Category: Features
  - Severity: LOW
  - Issue: Advanced "AI Analytics" dashboard.
  - Root Cause: Lack of high-level insights for premium users.
  - Business Impact: Upsell opportunity for Pro/Business tiers.
  - Objective: Create a dashboard for AI-extracted insights (Intent, Sentiment, Lead Score).
  - Detailed Instructions: 1. Aggregate `Lead.insights`. 2. Build visual analytics charts using Recharts.
  - Expected Deliverables: New Analytics page for premium users.
  - Dependencies: Lead enrichment data.
  - Notes: Deferred on 2026-05-22. This is a Phase 4 roadmap feature that depends on lead enrichment data accumulation and the AI intent/sentiment extraction pipeline. The current `Lead.insights` field is sparsely populated — implementing a dashboard now would show empty charts for most tenants. Better to implement after lead enrichment is systematically populated across all channels.
  - Rollout Risk: LOW.

- **Task 017**
  - Priority: LOW
  - Status: DECLINED
  - Category: Features
  - Severity: MEDIUM
  - Issue: Advanced WhatsApp Media Support.
  - Root Cause: Current integration is text-centric.
  - Business Impact: Enables rich-media CRM experiences.
  - Objective: Implement binary media persistence and outbound media support.
  - Detailed Instructions: 1. Implement media download/upload service. 2. Extend WhatsApp provider for outbound images/docs.
  - Expected Deliverables: Full media support across WhatsApp and CRM.
  - Dependencies: S3/Storage infrastructure.
  - Notes: Declined on 2026-05-22. Requires S3/GCS storage infrastructure for binary media persistence (image/video/document uploads and downloads). The application does not currently have a configured object storage service, and implementing one involves provisioning cloud storage buckets, configuring IAM/CORS policies, implementing signed URL generation, and adding CDN delivery — all of which are infrastructure-level concerns outside the scope of this codebase sweep.
  - Rollout Risk: MEDIUM.

- **Task 050**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: UI/UX
  - Severity: MEDIUM
  - Issue: Missing Skeleton Loaders and Accessibility in CRM.
  - Root Cause: `app/(dashboard)/conversations/[conversationId]/page.tsx` uses a simple "Loading..." text during 5s polls and initial load.
  - Business Impact: "Steppy" and unpolished feel for high-value CRM users.
  - Objective: Implement Skeleton loaders and ARIA labels.
  - Detailed Instructions:
    1. Create `components/conversation/conversation-skeleton.tsx`.
    2. Replace "Loading conversation..." text in `ConversationPage` with the skeleton.
    3. Audit `ConversationHeader` and `ReplyComposer` for missing `aria-label` on icon-only buttons (e.g., Mail, Phone icons in Header if they were buttons).
  - Expected Deliverables: Premium-feel CRM loading states and improved accessibility.
  - Dependencies: shadcn/ui.
  - Notes: High impact on perceived quality.
  - Rollout Risk: LOW.

## 3. Infrastructure & Redis Optimization (Startup Scale)

> **NOTE:** Redis scaling and managed Redis migration are intentionally DEFERRED until ReplyBase reaches meaningful production load (~100+ active concurrent tenants). AI agents should focus on optimizing current resource usage rather than suggesting enterprise-grade migrations.

- **Task 051**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Infrastructure
  - Issue: Potential Redis RAM starvation on low-resource droplets.
  - Objective: Implement Redis memory hardening.
  - Detailed Instructions: 1. Set `maxmemory 256mb` and `maxmemory-policy allkeys-lru` in the self-hosted Redis configuration (Coolify/Docker).
  - Expected Deliverables: Hard-capped Redis memory footprint.
  - Notes: Prevents OOM kills of the main Next.js application.

- **Task 052**
  - Priority: LOW
  - Status: PENDING
  - Category: Infrastructure
  - Issue: Unnecessary Redis dependency for rate limiting in single-instance deployments.
  - Objective: Verify and enforce in-memory rate limiting.
  - Detailed Instructions: 1. Review `lib/rate-limit.ts` and `lib/webchat-rate-limit.ts`. 2. Ensure default behavior is in-memory unless `REDIS_URL` is explicitly provided and required for multi-node sync.
  - Expected Deliverables: Reduced Redis load and latency.

- **Task 053**
  - Priority: LOW
  - Status: PENDING
  - Category: Infrastructure
  - Issue: Redundant L2 subscription caching.
  - Objective: Evaluate and potentially remove Redis caching from `lib/subscription.ts`.
  - Detailed Instructions: 1. Benchmark Postgres query performance for subscription checks. 2. If < 50ms, remove Redis L2 cache to save ~50MB RAM.
  - Expected Deliverables: Leaner Redis memory footprint.

- **Task 054**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Infrastructure
  - Issue: Fragmented background job queues.
  - Objective: Consolidate BullMQ queues.
  - Detailed Instructions: 1. Merge small queues into the primary `message-processing` queue where appropriate. 2. Reduce the number of Redis connections and worker overhead.
  - Expected Deliverables: Simplified infrastructure and lower CPU/RAM usage.



## Infrastructure & Performance Optimization (Post-Plausible Hardening)

### Phase 1: Resource Hardening (Low Effort)
- [ ] **Redis Memory Safety:** Set `maxmemory 256mb` and `maxmemory-policy allkeys-lru` in self-hosted Redis container.
- [ ] **Postgres Pool Optimization:** Reduce `max` connections in `lib/prisma.ts` from 50 to 20 to save ~400MB RAM.
- [ ] **Queue Retention Tuning:** Update `removeOnComplete` to 100 and `removeOnFail` to 500 for all BullMQ instances (`lib/queue.ts`, `lib/services/webhook-dispatcher.ts`).
- [ ] **AI Provider Failover Tuning:** Reduce `AbortController` timeout in `lib/ai-fallback.ts` to 8 seconds for faster failover.

### Phase 2: Performance Scalability (Medium Effort)
- [ ] **CRM Real-time Sync:** Migrate from 5s polling to Server-Sent Events (SSE) in `ConversationPage` to reduce DB load.
- [ ] **Log Retention Policy:** Create a cron job/script to prune `WebhookLog` and `ExecutionLog` rows older than 30 days.
- [ ] **Robust L1 Caching:** Replace manual `Map` caches in `lib/subscription.ts` with a bounded `lru-cache` library.
- [ ] **Usage Buffer Persistence:** Refactor `UsageBuffer` in `lib/subscription.ts` to use Redis `HINCRBY` instead of an in-memory Map for horizontal scalability.

### Phase 3: Reliability & Safety (High Effort)
- [ ] **AI Credit Circuit-Breaker:** Implement per-tenant daily AI usage caps to prevent cost runaway.
- [ ] **Analytics Engine Refactor:** Update `lib/analytics.ts` to use Prisma `groupBy` and `_count` instead of client-side JS processing.
- [ ] **Worker Process Isolation:** (Scaling Threshold: 100 Tenants) Split BullMQ workers into a dedicated service process.
- [ ] **Dead-Letter Queue Monitoring:** Add alerts (Telegram/Sentry) for failed jobs that exceed retry limits.
