---
title: Webchat Progress Status
description: Phase-by-phase implementation status of ReplyBase Webchat against the complete rollout plan
---

# Webchat Progress Status

Last reviewed: 2026-03-16 (Phase 7 unit test suite completed)

This document tracks current implementation status for the full webchat roadmap (Phases 0-8).

## Summary

- Completed: core Phase 0 baseline, core Phase 1 domain model layer, core Phase 2 APIs (including publicKey and telemetry), core Phase 3 embed script, core Phase 4 engine integration, strengthened Phase 5 token/CORS/rate-limit controls, initial Phase 6 dashboard setup UI, Phase 7 unit test suite (81 tests, 5 files).
- Partially completed: Phase 7 integration/e2e/chaos tests not yet written; Phase 8 rollout controls not started.
- Not started: Phase 8 feature-flagged rollout process.

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

Status: `Implemented`

Implemented:

- Reuses `converse(...)` pipeline.
- Webchat messages are persisted to CRM via existing `crm_messages` flow.
- Conversation continuity via `conversationId` and `externalSessionId`.
- Explicit flow-first fallback chain before AI for the webchat message route.
- Structured source metadata pipeline for `utm`, referrer, locale, page URL, page title, and origin.
- Dedicated safe fallback copy for engine failures.

Pending:

- None for current Phase 4 scope.

Code references:

- `lib/ai-engine.ts`
- `app/api/webchat/message/route.ts`
- `lib/webchat.ts`

### Phase 5: Security + abuse protection

Status: `Implemented`

Implemented:

- Signed short-lived session tokens (HMAC + expiry).
- CORS origin control via `WEBCHAT_ALLOWED_ORIGINS`.
- Strict Origin + Referer verification with reasoned denials.
- Production guard to prevent wildcard CORS defaults unless explicitly overridden.
- Rate limiting (IP + session) on `init`, `message`, and `events`.
- Shared rate-limit backend support via Upstash Redis with automatic in-memory fallback.
- Bot mitigation signals (honeypot + minimum init elapsed checks) on `init` and `message`.
- Configurable PII retention controls for webchat contact and metadata persistence.

Pending:

- None for current Phase 5 scope.

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

Status: `Partially Implemented`

Implemented:

- Test framework: Vitest 3.2.x + `@vitest/coverage-v8`, installed as devDependencies.
- `vitest.config.ts` with `node` environment, `@/` alias, and V8 coverage scoped to `lib/webchat*.ts` and `app/api/webchat/**`.
- npm scripts: `test` (single run), `test:watch`, `test:coverage`.
- **81 passing unit tests across 5 files:**
  - `tests/webchat/bot-mitigation.test.ts` — 12 tests (honeypot, elapsedMs threshold, env overrides, disabled mode)
  - `tests/webchat/privacy.test.ts` — 20 tests (retain/mask/drop modes, nested records, arrays, contact sanitization)
  - `tests/webchat/cors.test.ts` — 19 tests (dev wildcard, prod block, allowlist matching, Origin/Referer mismatch, referer-only path, `STRICT_ORIGIN_REFERER_MATCH` override)
  - `tests/webchat/rate-limit.test.ts` — 9 tests (first request, remaining decrement, limit exhaustion, scope isolation, window reset via fake timers, header helpers)
  - `tests/webchat/route-schemas.test.ts` — 21 tests (init/message/events Zod schema validation: missing identifiers, empty strings, invalid emails, invalid URLs, unknown enum values)
- Coverage achieved on core security helpers:
  - `webchat-bot-mitigation.ts`: 100% statements / 95% branches
  - `webchat-cors.ts`: 86% statements / 88% branches
  - `webchat-privacy.ts`: 80% statements / 89% branches
  - `webchat-rate-limit.ts`: 48% statements (Upstash async path requires integration env)

Missing:

- Integration tests for full route handlers (require DB + Next.js test environment)
- E2E tests for the embed widget (browser + Playwright)
- Chaos/load tests for rate-limit and concurrent session handling
- webchat-specific metrics instrumentation

Code references:

- `vitest.config.ts`
- `tests/webchat/bot-mitigation.test.ts`
- `tests/webchat/privacy.test.ts`
- `tests/webchat/cors.test.ts`
- `tests/webchat/rate-limit.test.ts`
- `tests/webchat/route-schemas.test.ts`

### Phase 8: Rollout strategy

Status: `Not Started`

Missing:

- `webchat_enabled` feature flag
- pilot tenant rollout controls
- progressive plan-tier rollout policy
- SLA monitoring and rollout playbook

## Recommended Next Actions

1. Add integration tests for webchat route handlers (real DB + `msw` or test Next.js server).
2. Add E2E widget tests with Playwright (embed script in a real browser against a local server).
3. Add feature-flag rollout controls and pilot policies (Phase 8).
