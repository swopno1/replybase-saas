# ReplyBase — Master Task List

> **Last updated:** June 2026  
> Priority order: **P0 → P1 → P2 → P3 → Backlog**  
> Status legend: `COMPLETED` · `IN PROGRESS` · `PENDING` · `DEFERRED` · `DECLINED`

---

## What ReplyBase Has Already Built

Before reading the task list, here is the confirmed production state of the platform:

**Core Platform**
- Multi-tenant SaaS with plan-gated features (Free / Launch / Grow / Scale / Business)
- Subscription billing via Stripe with FOUNDING50 promo and annual billing support
- Full admin panel: subscriber management, AI onboarding, simulation lab, audit logs
- Auth, RBAC, and `withAuthAndTenant` middleware enforcing tenant isolation

**Channels (Live)**
- Webchat (embeddable widget with custom domains)
- Facebook Messenger (webhook-backed, page access token auth)
- WhatsApp Cloud API (official API, media-safe)
- Telegram Bot (webhook-based)
- Website Forms (lead capture forms)

**AI & Automation**
- Flow Builder: 7 node types (`message`, `input`, `condition`, `action`, `wait`, `typing`, `end`)
- 8 action types: `tag_user`, `update_status`, `call_flow`, `end_flow`, `schedule`, `checkout`, `booking`, `trigger_webhook`
- 30+ industry flow templates
- AI fallback engine with guardrails, injection protection, and cross-channel context
- AI onboarding: structured business summarization → bot system prompt generation
- Multi-provider AI routing (DigitalOcean primary, Google embeddings)
- Lead enrichment with AI scoring (urgency, category, needs)

**CRM & Leads**
- Unified inbox across all channels
- Contact identity stitching (cross-channel conversation linking)
- Lead status tracking, tagging, and CRM-style pipeline
- Instant lead notifications via Telegram and email

**Infrastructure**
- BullMQ background workers (message processing + webhook dispatch)
- Deep health checks (`/api/health` with Prisma + Redis pings)
- Redis for rate limiting, subscription caching, and usage buffering
- Sentry observability with AI task tagging and performance spans
- GDPR-aligned data deletion and export workflows

---

## P0 — Active / Must Ship Next

### Task 055 — Residual Manual Auth Scoping
- **Status:** COMPLETED
- **Category:** Security / Multi-tenancy
- **Severity:** HIGH
- **Issue:** Several secondary routes still use raw `getServerSession` + manual `prisma` lookups instead of `withAuthAndTenant`, creating IDOR risk.
- **Scope:**
  - `app/api/tenant/channels/route.ts`
  - `app/api/tenant/lead-notifications/route.ts`
  - `app/api/tenant/lead-notifications/test/route.ts`
  - `app/api/analytics/onboarding-milestones/route.ts` → use `withAdmin`
  - `app/api/flows/from-template/`, `[id]/assign/`, `[id]/clone/`, `[id]/duplicate/` → use `withAuthAndTenant`
- **Deliverable:** Zero raw `getServerSession` usage in non-admin routes.
- **Risk:** LOW

### Task 044 — Multi-Tenant Sentry Tagging
- **Status:** PENDING
- **Category:** Observability
- **Issue:** Sentry errors are not enriched with `tenant_id` or `user_id`, making cross-tenant debugging slow.
- **Scope:** Update `withAuthAndTenant` in `lib/route-helpers.ts` to call `Sentry.setUser()` and `Sentry.setTag("tenant_id", ...)`. Propagate tenant tag to BullMQ worker jobs in `lib/queue.ts`.
- **Deliverable:** Every server-side Sentry event tagged with tenant and user.
- **Risk:** LOW

### Task 046 — Sentry PII Hardening
- **Status:** PENDING
- **Category:** Security
- **Issue:** `sendDefaultPii: true` and `includeLocalVariables: true` risk leaking API keys and user data into Sentry.
- **Scope:** Set `sendDefaultPii: false` across all Sentry config files. Add `beforeSend` hook to scrub Stripe and AI keys from breadcrumbs.
- **Deliverable:** Privacy-safe observability with no credential leakage.
- **Risk:** LOW

---

## P1 — Business Tier Feature Expansion

### Task 057 — API Key Management (Business Plan)
- **Status:** PENDING
- **Category:** Feature / Business Tier
- **Severity:** HIGH
- **Issue:** Business plan subscribers have no programmatic API access. This is a key differentiator for enterprise buyers and integration-heavy SMBs.
- **Scope:**
  1. DB: Add `ApiKey` model (`id`, `tenantId`, `name`, `keyHash`, `prefix`, `scopes`, `lastUsedAt`, `expiresAt`, `createdAt`). Store only hash; show prefix (e.g. `rb_live_xxxx`) to user once.
  2. Plan gate: Only accessible on Scale and Business plans (`maxApiKeys` limit per plan).
  3. API routes:
     - `POST /api/tenant/api-keys` — create key, return plaintext once
     - `GET /api/tenant/api-keys` — list keys (prefix + metadata, no hash)
     - `DELETE /api/tenant/api-keys/[id]` — revoke key
  4. Auth middleware: `withApiKey` middleware to authenticate external requests via `Authorization: Bearer rb_live_xxx` header. Validates hash, checks scopes, updates `lastUsedAt`.
  5. UI: "API Keys" section in Settings → Integrations tab (Business plan badge + upsell for lower tiers).
  6. Docs: Add `/docs/api/reference` and `/docs/api/webhooks` pages to frontend (see Task 062).
- **Deliverable:** Full API key lifecycle (create, list, revoke) with auth middleware.
- **Risk:** LOW

### Task 058 — Outgoing Webhooks (Business Plan)
- **Status:** PENDING
- **Category:** Feature / Business Tier
- **Severity:** HIGH
- **Issue:** No way for Business subscribers to push live events (new lead, new message, status change) to external systems (Zapier, Make, custom CRMs). This blocks enterprise integrations.
- **Scope:**
  1. DB: Add `WebhookEndpoint` model (`id`, `tenantId`, `url`, `secret`, `events[]`, `isActive`, `failureCount`, `lastDeliveredAt`).
  2. Events to support: `lead.created`, `lead.updated`, `conversation.new_message`, `contact.updated`, `bot.flow_completed`.
  3. Delivery: Reuse existing `webhook-dispatcher` BullMQ worker. Add HMAC-SHA256 signature header (`X-ReplyBase-Signature`).
  4. Retry logic: 3 retries with exponential backoff. Disable endpoint after 10 consecutive failures.
  5. UI: "Webhooks" section in Settings → Integrations. Show delivery log (last 50 attempts, status, response code).
  6. Plan gate: Scale and Business plans only.
- **Deliverable:** Working outgoing webhook delivery with signature verification and retry.
- **Risk:** MEDIUM (BullMQ queue changes)

### Task 059 — White-Label Branding (Business Plan)
- **Status:** PENDING
- **Category:** Feature / Business Tier
- **Severity:** MEDIUM
- **Issue:** Business plan buyers (agencies, resellers) need to present the webchat widget and notification emails under their own brand identity.
- **Scope:**
  1. DB: Add `branding` JSON column to `Tenant` model (or separate `TenantBranding` table): `logoUrl`, `primaryColor`, `accentColor`, `botAvatarUrl`, `companyName`, `emailFromName`, `emailFromAddress` (verified domain).
  2. Webchat widget: Read branding config via `/api/webchat/config` and apply CSS variables + logo at widget init.
  3. Email notifications: Replace default ReplyBase branding in lead notification emails with tenant's configured name/logo.
  4. UI: "Branding" tab in Settings (Business plan only). Upload logo, pick colors, preview live webchat widget.
  5. Plan gate: Business plan only. Show locked state with upgrade CTA for lower tiers.
- **Deliverable:** Configurable branding on webchat widget and email notifications.
- **Risk:** LOW

### Task 060 — SLA Support Tiers
- **Status:** PENDING
- **Category:** Feature / Business Tier
- **Severity:** MEDIUM
- **Issue:** Business plan buyers expect a defined support SLA. Currently all plans get the same community/email support with no commitment.
- **Scope:**
  1. Define SLA tiers formally:
     - **Free:** Community (no SLA)
     - **Launch / Grow:** Email support, best effort (48h target)
     - **Scale:** Priority email support, 24h response target
     - **Business:** Priority+ — 4h response target, dedicated Slack/WhatsApp channel option, quarterly review call
  2. Surface SLA in: pricing page, subscription settings page, and admin subscriber view.
  3. Admin tooling: Tag Business subscribers in admin panel with "Priority+" badge. Add a fast-track support form route for Business tenants (`/api/support/priority`).
  4. Docs: Add SLA commitments to `/docs/features` and `/docs/faq`.
- **Deliverable:** SLA tiers documented, surfaced in product, and routed in admin.
- **Risk:** LOW

### Task 041 — Webchat Sequential DB Writes
- **Status:** PENDING
- **Category:** Performance / Engineering
- **Issue:** `app/api/webchat/message/route.ts` performs sequential Prisma writes (`idempotencyKey.create`, `crmMessage.create`, `crmMessage.createMany`) instead of batching in a `prisma.$transaction`.
- **Deliverable:** Transactional write path for webchat message ingestion.
- **Risk:** LOW

---

## P2 — Product Quality & UX

### Task 050 — CRM Skeleton Loaders & Accessibility
- **Status:** PENDING
- **Category:** UI/UX
- **Issue:** `ConversationPage` shows plain "Loading..." text during polls and initial load.
- **Scope:**
  1. Create `components/conversation/conversation-skeleton.tsx`.
  2. Add `aria-label` to icon-only buttons: `Mail`, `Phone` in `ConversationHeader`; `Sparkles` in `ReplyComposer`.
- **Deliverable:** Polished loading states and WCAG-compliant button labels.
- **Risk:** LOW

### Task 047 — Distributed Tracing for BullMQ Workers
- **Status:** PENDING
- **Category:** Observability
- **Issue:** BullMQ workers don't inherit Sentry trace context from the originating webhook. Impossible to trace a message from ingress → AI → delivery as a single trace.
- **Scope:** Capture `sentry-trace` and `baggage` headers in webhook routes. Pass to BullMQ job data. Use `Sentry.continueTrace` in worker loops.
- **Deliverable:** End-to-end distributed traces across queue boundaries.
- **Risk:** MEDIUM

### Task 056 — N+1 Query in Plan Downgrade Logic
- **Status:** PENDING
- **Category:** Performance
- **Issue:** `lib/subscription.ts` `handlePlanDowngrade` fetches channels sequentially per bot.
- **Scope:** Use `channel.findMany({ botId: { in: botIds } })` + in-memory grouping + `updateMany`.
- **Deliverable:** Batch downgrade handler.
- **Risk:** LOW

### Task 062 — Frontend API Docs Pages
- **Status:** PENDING
- **Category:** Docs / Frontend
- **Issue:** `/docs/api/reference` and `/docs/api/webhooks` return 404. Business plan buyers expect API documentation.
- **Scope:**
  1. Create `app/docs/api/reference/page.tsx` — "Coming Soon" page with API overview, key concepts, and notify-me CTA.
  2. Create `app/docs/api/webhooks/page.tsx` — "Coming Soon" page with webhook concepts and event list.
  3. Add "Developer API" section to `DocsSidebar` with both links.
  4. Update sidebar `navigation` array.
- **Deliverable:** Two live docs pages + sidebar entries.
- **Risk:** LOW

---

## P3 — Infrastructure & Redis Optimization

> Redis scaling and managed Redis migration are intentionally deferred until ~100+ concurrent active tenants.

### Task 051 — Redis Memory Safety
- **Status:** PENDING
- **Scope:** Set `maxmemory 256mb` + `maxmemory-policy allkeys-lru` in self-hosted Redis container (Coolify/Docker).

### Task 052 — In-Memory Rate Limit Default
- **Status:** PENDING
- **Scope:** Confirm `lib/rate-limit.ts` defaults to in-memory when `REDIS_URL` is absent. No Redis dependency in single-instance deployments.

### Task 053 — Subscription Cache Evaluation
- **Status:** PENDING
- **Scope:** Benchmark Postgres subscription query latency. If < 50ms, remove Redis L2 cache from `lib/subscription.ts` to free ~50MB RAM.

### Task 054 — BullMQ Queue Consolidation
- **Status:** PENDING
- **Scope:** Merge low-volume queues into `message-processing` queue. Reduce Redis connections and worker overhead.

---

## Completed

| Task | Description | Date |
|------|-------------|------|
| **039** | Deep health checks (`/api/health` with Prisma + Redis pings) | Aug 2026 |
| **045** | AI provider Sentry instrumentation (provider/model/task tags + spans) | Jun 2026 |
| **055** | Residual manual auth scoping — migrated 8 routes from raw getServerSession to withAuthAndTenant/withAdmin | Jun 2026 |
| **049** | Pricing migration: Free/Launch/Grow/Scale/Business, FOUNDING50 promo, channel type gating | May 2026 |
| Phase 1 infra | Redis memory cap, Postgres pool tuning, BullMQ retention tuning, AI timeout reduction | Aug 2026 |

---

## Backlog / Deferred

| Task | Description | Reason |
|------|-------------|--------|
| **006** | AI Analytics dashboard (intent, sentiment, lead score charts) | Deferred — insufficient lead enrichment data to populate charts meaningfully. Revisit at 1k+ enriched leads. |
| **031** | Admin real-time queue/AI monitoring UI (Recharts) | Deferred — `/api/admin/metrics` API is complete. UI deferred; Grafana/Datadog can consume API in interim. |
| **042** | CRM real-time updates via SSE/WebSocket | Deferred — requires infrastructure migration (persistent connections). Current 5s polling is adequate for current scale. |
| **048** | Sentry quota optimization and dynamic sampling | Deferred — becomes critical at scale. Current sampling acceptable for free tier quota. |

---

## Declined

| Task | Description | Reason |
|------|-------------|--------|
| **001** | Redis caching for dashboard metrics | Dashboard queries are already optimized indexed reads. Redis adds cache-staleness risk with no measurable gain at current scale. |
| **004** | Automated DB/Redis backup scripts in container | Infrastructure concern, not application code. Managed DB snapshots (DO/AWS/GCP) handle this at infra level. |
| **017** | Advanced WhatsApp media persistence | Requires S3/object storage infrastructure not yet provisioned. Revisit when storage is available. |
| **033** | WebSocket-based CRM updates | Vercel serverless deployment doesn't support persistent connections natively. Revisit with infrastructure migration. |
