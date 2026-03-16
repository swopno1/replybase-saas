---
title: Webchat Progress Status
description: Phase-by-phase implementation status of ReplyBase Webchat against the complete rollout plan
---

# Webchat Progress Status

Last reviewed: 2026-03-16 (updated after Phase 2 publicKey/events rollout)

This document tracks current implementation status for the full webchat roadmap (Phases 0-8).

## Summary

- Completed: core Phase 0 baseline, core Phase 1 domain model layer, core Phase 2 APIs (including publicKey and telemetry), core Phase 3 embed script, initial Phase 4 engine integration, initial Phase 5 token/CORS controls, initial Phase 6 dashboard setup UI.
- Partially completed: security hardening, diagnostics, observability, and rollout operations.
- Not started: full Phase 7 automated QA matrix and Phase 8 feature-flagged rollout process.

## Phase Status Matrix

### Phase 0: Stabilize schema and channel typing

Status: `In Progress (mostly done)`

Completed:

- Channel creation paths normalize to lowercase `web`.
- Legacy row migration script exists: `pnpm run normalize:web-channel-type`.
- Non-web channels require `channelId`, web channels allow null `channelId`.

Pending:

- Prisma enum for `Channel.type` is not implemented yet (`Channel.type` is still `String`).
- Helper still accepts both `web` and `Web` values for compatibility.

Code references:

- `app/api/bots/route.ts`
- `app/api/bots/[botId]/channels/route.ts`
- `scripts/normalize-web-channel-type.ts`
- `prisma/schema.prisma`
- `lib/webchat.ts`

### Phase 1: Web chat domain model

Status: `Implemented (v1) / In Progress`

Implemented:

- `WebChatSite` model added.
- `WebChatSession` model added.
- `WebChatEvent` model added.
- Relations wired to `Tenant`, `Bot`, and `CrmConversation`.
- Migration created/applied: `20260316000055_add_webchat_site_session_event_models`.
- Runtime helpers now create/use site/session rows during init/message paths.

Pending refinements:

- Dashboard key rotation UX (`publicKey` / `secretKey`) is not implemented yet.
- Domain governance workflows (`allowedDomains`) are still minimal.

Code references:

- `prisma/schema.prisma`
- `prisma/migrations/20260316000055_add_webchat_site_session_event_models/migration.sql`
- `lib/webchat.ts`
- `app/api/webchat/init/route.ts`
- `app/api/webchat/message/route.ts`

### Phase 2: Public webchat API layer

Status: `Implemented (MVP+)`

Implemented:

- `POST /api/webchat/init`
- `POST /api/webchat/message`
- `GET /api/webchat/config`
- `POST /api/webchat/events`
- `OPTIONS` handlers for CORS preflight on all webchat routes.
- `publicKey`-driven init/config contract.
- Site-domain ownership checks during init/config/events.

Pending:

- Signed one-time init nonce and replay window enforcement.
- Stronger telemetry taxonomy and sampling policy.

Code references:

- `app/api/webchat/init/route.ts`
- `app/api/webchat/message/route.ts`
- `app/api/webchat/config/route.ts`
- `app/api/webchat/events/route.ts`

### Phase 3: Widget + embed SDK

Status: `Implemented (MVP)`

Implemented:

- `public/embed/replybase-webchat.js`
- Launcher + panel + messaging UI
- Runtime init/config/message integration
- Local session persistence
- Position, title, color, welcome text support

Pending:

- iframe sandbox or shadow DOM isolation
- unread badge
- mobile full-screen mode
- cookie consent integration
- configurable telemetry toggles

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
- Embed snippet generation and copy
- Live preview with interactive send simulation and reset

Pending:

- public key and domain list management UI
- diagnostics panel (blocked origins, rate limit events, last ping)
- one-click test widget launch against selected site/domain

Code references:

- `app/(dashboard)/integrations/webchat/page.tsx`
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
2. Add dashboard UI for key rotation and allowed-domain management.
3. Add test coverage (unit + integration + e2e) before broad rollout.
4. Add feature-flag rollout controls and pilot policies.
