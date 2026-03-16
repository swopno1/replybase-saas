---
title: Webchat Progress Status
description: Phase-by-phase implementation status of ReplyBase Webchat against the complete rollout plan
---

# Webchat Progress Status

Last reviewed: 2026-03-16 (re-audited against full Phase 0-8 plan)

This document tracks current implementation status for the full webchat roadmap (Phases 0-8).

## Summary

- Completed: core Phase 0 baseline, core Phase 1 domain model layer, core Phase 2 APIs (including publicKey and telemetry), core Phase 3 embed script, initial Phase 4 engine integration, initial Phase 5 token/CORS/rate-limit controls, initial Phase 6 dashboard setup UI.
- Partially completed: security hardening, diagnostics, observability, and rollout operations.
- Not started: full Phase 7 automated QA matrix and Phase 8 feature-flagged rollout process.

## Phase Status Matrix

### Phase 0: Stabilize schema and channel typing

Status: `Implemented`

Completed:

- Channel creation paths normalize to lowercase `web`.
- Legacy row normalization script exists: `pnpm run normalize:web-channel-type`.
- Non-web channels require `channelId`, web channels allow null `channelId`.
- Prisma enum is implemented for `Channel.type` (`web`, `facebook`, `telegram`, `whatsapp`).
- Webchat helper now uses strict lowercase `web` lookup (no `"Web"` fallback).

Pending:

- None for Phase 0 baseline.

Code references:

- `app/api/bots/route.ts`
- `app/api/bots/[botId]/channels/route.ts`
- `scripts/normalize-web-channel-type.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260316170000_channel_type_enum_lowercase/migration.sql`
- `lib/webchat.ts`

### Phase 1: Web chat domain model

Status: `Implemented`

Implemented:

- `WebChatSite` model added.
- `WebChatSession` model added.
- `WebChatEvent` model added.
- Relations wired to `Tenant`, `Bot`, and `CrmConversation`.
- Migration created/applied: `20260316000055_add_webchat_site_session_event_models`.
- Runtime helpers now create/use site/session rows during init/message paths.

Pending refinements:

- None for Phase 1 baseline.

Code references:

- `prisma/schema.prisma`
- `prisma/migrations/20260316000055_add_webchat_site_session_event_models/migration.sql`
- `lib/webchat.ts`
- `app/api/webchat/init/route.ts`
- `app/api/webchat/message/route.ts`

### Phase 2: Public webchat API layer

Status: `Implemented`

Implemented:

- `POST /api/webchat/init`
- `POST /api/webchat/message`
- `GET /api/webchat/config`
- `POST /api/webchat/events`
- `OPTIONS` handlers for CORS preflight on all webchat routes.
- `publicKey`-driven init/config contract.
- Site-domain ownership checks during init/config/events.
- Signed one-time init challenge issued by `config` and consumed by `init`.
- Replay-window enforcement for init challenges via durable nonce-use tracking.
- Structured telemetry taxonomy with sampling policy for widget lifecycle events.

Pending:

- None for current Phase 2 scope.

Code references:

- `app/api/webchat/init/route.ts`
- `app/api/webchat/message/route.ts`
- `app/api/webchat/config/route.ts`
- `app/api/webchat/events/route.ts`

### Phase 3: Widget + embed SDK

Status: `Implemented`

Implemented:

- `public/embed/replybase-webchat.js`
- Launcher + panel + messaging UI
- Runtime init/config/message integration
- Local session persistence
- Position, title, color, welcome text support
- Dashboard-generated snippet targets `data-public-key` when site credentials exist
- Shadow DOM widget isolation
- Unread badge on the launcher button
- Mobile full-screen mode support
- Cookie-consent-aware storage and initialization gating
- Configurable telemetry toggles via embed attributes/config

Pending:

- None for current Phase 3 scope.

Code references:

- `public/embed/replybase-webchat.js`
- `documentation/webchat-embed.md`

### Phase 4: Conversation engine integration

Status: `Partially Implemented`

Implemented:

- Reuses `converse(...)` pipeline.
- Webchat messages are persisted to CRM via existing `crm_messages` flow.
- Conversation continuity via `conversationId` and `externalSessionId`.

Pending:

- Explicit flow-first fallback chain before AI for webchat route.
- Structured source metadata pipeline (utm/referrer/locale/page URL) with explicit downstream handling.
- Dedicated safe fallback copy for engine failures.

Code references:

- `lib/ai-engine.ts`
- `app/api/webchat/message/route.ts`
- `lib/webchat.ts`

### Phase 5: Security + abuse protection

Status: `Partially Implemented`

Implemented:

- Signed short-lived session tokens (HMAC + expiry).
- CORS origin control via `WEBCHAT_ALLOWED_ORIGINS`.
- Basic origin allow/deny check.
- Rate limiting (IP + session) on `init`, `message`, and `events`.

Pending:

- strict Origin + Referer verification strategy
- bot mitigation (honeypot/captcha)
- PII retention controls
- production guard to prevent wildcard CORS by default
- distributed rate-limit backend (current limiter is in-memory per instance)

Code references:

- `lib/webchat-session.ts`
- `lib/webchat-cors.ts`
- `lib/webchat-rate-limit.ts`
- `app/api/webchat/*.ts`

### Phase 6: Dashboard UX for webchat management

Status: `Implemented (MVP) / Partially complete`

Implemented:

- Dashboard page: `/integrations/webchat`
- Create/select web channel
- Theme config fields
- Public key display and site-backed embed snippet generation
- Allowed-domain management UI backed by `WebChatSite.allowedDomains`
- Diagnostics panel for last ping, blocked origins, rate-limit events, and recent site errors
- One-click dashboard test-widget launch with an internal harness page that loads the real embed script
- Embed snippet generation and copy
- Live preview with interactive send simulation and reset

Pending:

- none in current Phase 6 MVP scope

Code references:

- `app/(dashboard)/integrations/webchat/page.tsx`
- `app/api/bots/[botId]/webchat-site/diagnostics/route.ts`
- `components/app-sidebar.tsx`

### Phase 7: Observability + QA

Status: `Not Started`

Missing:

- webchat-specific metrics instrumentation
- unit/integration/e2e/chaos test suites for webchat routes and widget

Current state:

- TypeScript compile checks pass, but no dedicated automated webchat test harness exists.

### Phase 8: Rollout strategy

Status: `Not Started`

Missing:

- `webchat_enabled` feature flag
- pilot tenant rollout controls
- progressive plan-tier rollout policy
- SLA monitoring and rollout playbook

## Recommended Next Actions

1. Add production CORS hardening defaults and stricter Origin/Referer policy.
2. Upgrade webchat rate limiting to shared storage for multi-instance deployments.
3. Add test coverage (unit + integration + e2e) before broad rollout.
4. Add feature-flag rollout controls and pilot policies.
