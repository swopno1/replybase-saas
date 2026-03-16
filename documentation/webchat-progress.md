---
title: Webchat Progress Status
description: Phase-by-phase implementation status of ReplyBase Webchat against the complete rollout plan
---

# Webchat Progress Status

Last reviewed: 2026-03-16 (Phase 8 expanded — rollout controls + initial Playwright E2E coverage implemented)

This document tracks current implementation status for the full webchat roadmap (Phases 0-8).

## Summary

- Completed: Phases 0–7 fully implemented: baseline, domain model, public API, embed SDK, conversation engine, security hardening, dashboard UX, automated test suite (118 tests / 8 files), and structured metrics instrumentation.
- Partially completed: Phase 8 rollout foundation (`webchat_enabled` policy via rollout helper, pilot/plan-tier/GA modes, route enforcement, and admin rollout controls UI/API).

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

Status: `Implemented`

Implemented:

- Test framework: Vitest 3.2.x + `@vitest/coverage-v8`, installed as devDependencies.
- `vitest.config.ts` with `node` environment, `@/` alias, and V8 coverage scoped to `lib/webchat*.ts` and `app/api/webchat/**`.
- npm scripts: `test` (single run), `test:watch`, `test:coverage`.
- **118 passing tests across 8 files at Phase 7 completion:**
  - `tests/webchat/bot-mitigation.test.ts` — 12 tests (honeypot, elapsedMs threshold, env overrides, disabled mode)
  - `tests/webchat/privacy.test.ts` — 20 tests (retain/mask/drop modes, nested records, arrays, contact sanitization)
  - `tests/webchat/cors.test.ts` — 19 tests (dev wildcard, prod block, allowlist matching, Origin/Referer mismatch, referer-only path, `STRICT_ORIGIN_REFERER_MATCH` override)
  - `tests/webchat/rate-limit.test.ts` — 9 tests (first request, remaining decrement, limit exhaustion, scope isolation, window reset via fake timers, header helpers)
  - `tests/webchat/route-schemas.test.ts` — 21 tests (init/message/events Zod schema validation: missing identifiers, empty strings, invalid emails, invalid URLs, unknown enum values)
- **37 passing integration tests across 3 files:**
  - `tests/webchat/integration/init-route.test.ts` — 13 tests (CORS denied, schema validation, bot mitigation, channel not found, challenge invalid, origin blocked, success paths, OPTIONS preflight)
  - `tests/webchat/integration/message-route.test.ts` — 13 tests (CORS denied, schema validation, invalid token, site/channel/bot mismatches, honeypot, origin blocked, AI success, flow success, safe fallback)
  - `tests/webchat/integration/events-route.test.ts` — 11 tests (CORS denied, schema validation, invalid token, site not found, origin blocked, all 5 event types, sampled-out, DB persistence)
- Coverage achieved on core security helpers:
  - `webchat-bot-mitigation.ts`: 100% statements / 95% branches
  - `webchat-cors.ts`: 86% statements / 88% branches
  - `webchat-privacy.ts`: 80% statements / 89% branches
  - `webchat-rate-limit.ts`: 48% statements (Upstash async path requires integration env)
- Structured metrics instrumentation via `lib/webchat-metrics.ts`:
  - Emits newline-delimited JSON to stdout (controlled by `WEBCHAT_METRICS_ENABLED` env var)
  - Events: `webchat.session.init`, `webchat.message.processed`, `webchat.event.tracked`, `webchat.event.sampled_out`, `webchat.rate_limit.hit`, `webchat.cors.denied`
  - Wired into `app/api/webchat/init/route.ts`, `message/route.ts`, and `events/route.ts`

Pending (future enhancements):

- Expand Playwright E2E scenarios (error paths, mobile fullscreen behavior, consent-required path)
- Chaos/load tests for rate-limit and concurrent session handling

Code references:

- `vitest.config.ts`
- `lib/webchat-metrics.ts`
- `tests/webchat/bot-mitigation.test.ts`
- `tests/webchat/privacy.test.ts`
- `tests/webchat/cors.test.ts`
- `tests/webchat/rate-limit.test.ts`
- `tests/webchat/route-schemas.test.ts`
- `tests/webchat/integration/init-route.test.ts`
- `tests/webchat/integration/message-route.test.ts`
- `tests/webchat/integration/events-route.test.ts`

### Phase 8: Rollout strategy

Status: `Partially Implemented`

Implemented:

- Rollout policy helper: `lib/webchat-rollout.ts` with support for staged modes via env:
  - `WEBCHAT_ROLLOUT_MODE`: `off` | `pilot` | `tiered` | `ga`
  - `WEBCHAT_ENABLED_TENANT_IDS` / `WEBCHAT_DISABLED_TENANT_IDS`
  - `WEBCHAT_PILOT_TENANT_IDS`
  - `WEBCHAT_ALLOWED_PLAN_NAMES`
- Progressive feature-flag evaluation with `plan.features.webchat_enabled` support.
- Runtime enforcement added to all public webchat APIs:
  - `GET /api/webchat/config`
  - `POST /api/webchat/init`
  - `POST /api/webchat/message`
  - `POST /api/webchat/events`
- Admin rollout controls implemented:
  - `GET/PATCH /api/admin/webchat-rollout`
  - Dashboard page: `/admin/webchat-rollout`
  - Admin navigation tab for rollout controls
- Initial Playwright E2E widget test coverage added:
  - `playwright.config.ts` + `npm run test:e2e`
  - `app/webchat-e2e/page.tsx` (public harness route)
  - `tests/e2e/webchat-widget.spec.ts` (open widget + send message happy path with mocked webchat APIs)
- QA coverage for rollout controls:
  - `tests/webchat/rollout.test.ts` — 7 tests (mode parsing, pilot allow/block, tiered plan feature/allowlist, GA explicit deny)
  - Integration denial-path checks added to init/message/events route test suites.
- Current test baseline after Phase 8 updates: **128 passing Vitest tests across 9 files + 1 passing Playwright E2E test**.

Missing:

- SLA monitoring and rollout playbook
- Pilot runbook execution and staged production enablement

## Recommended Next Actions

1. Expand Playwright E2E coverage (blocked-origin flow, consent-required flow, and mobile fullscreen mode).
2. Add SLA monitoring dashboards and finalize rollout playbook for pilot-to-GA progression.
3. Execute pilot rollout runbook and promote to GA after telemetry thresholds are stable.
