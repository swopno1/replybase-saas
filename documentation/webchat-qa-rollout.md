---
title: Webchat QA and Rollout Guide
description: Quality gates, test plan, and rollout sequence for ReplyBase Webchat
---

# Webchat QA and Rollout Guide

## Objective

Define the minimum quality and operations process before broad webchat rollout.

## Quality Gates

Before enabling for customer tenants:

1. All webchat API routes pass integration tests.
2. Embed script works on desktop and mobile breakpoints.
3. CORS and domain restrictions are verified in production-like env.
4. AI fallback behavior is validated under failure scenarios.
5. Dashboard setup flow can create channel and generate working snippet.

## Test Plan

### Unit tests

Focus areas:

- token signing and verification
- token expiry behavior
- origin allow/deny logic
- request validation for init/message/config

### Integration tests

Focus areas:

- init creates/reuses visitor and conversation
- message route persists inbound/outbound transcript
- config route returns safe-only payload
- invalid token / invalid origin / invalid conversation guards

### E2E tests

Focus areas:

- embed script boot sequence
- launcher open/close behavior
- message roundtrip rendering
- mobile viewport behavior

### Chaos tests

Scenarios:

- AI timeout
- engine unavailable
- CORS misconfiguration
- repeated message storm/rate-limit pressure

## Monitoring Dashboard

The admin monitoring view is now available at `/admin/webchat-monitoring` and should be the first stop before broadening rollout. It summarizes the last 24 hours of:

- active sites and sites with live traffic
- webchat sessions, conversations, messages, and widget events
- widget error-event rate and last-activity freshness
- blocked-origin, rate-limit, rollout-disabled, invalid-token, and bot-mitigation incident counts
- recent cross-tenant incident feed for fast triage

## Recommended Metrics

Track at minimum:

- init success rate
- message success rate
- message latency p50/p95
- AI error rate
- blocked origin count
- invalid token count
- rollout-disabled count by tenant during pilot/tiered phases
- last-activity freshness across active pilot sites

## Rollout Sequence

1. Enable behind feature flag (`webchat_enabled`).
2. Internal validation tenant(s) only.
3. Pilot 1-2 external tenants.
4. Expand by plan tier after SLO targets are stable.
5. Run post-rollout hardening pass and update incident playbook.

## Operational Runbook (MVP)

When incident occurs:

1. Check API route logs for init/message/config errors.
2. Check blocked origins and env allowlist values.
3. Check token-secret consistency across environments.
4. Verify AI engine health and fallback behavior.
5. Pause tenant rollout if error budget is exceeded.

## Pilot-to-GA Playbook

### Pilot entry

Before enabling any external tenant:

1. Confirm Vitest and Playwright webchat suites are green.
2. Verify the tenant is intentionally allowlisted in `/admin/webchat-rollout`.
3. Confirm allowed domains are configured and test widget boot from the tenant domain.
4. Record the tenant owner and rollback contact in the release notes.

### Daily pilot review

Use `/admin/webchat-monitoring` at least once per day and verify:

1. Last activity is fresh for active pilot tenants.
2. Widget error-event rate stays below 3% for the last 24 hours.
3. Blocked-origin spikes are understood and not caused by misconfigured embeds.
4. Rate-limit incidents remain below 10 per 24 hours unless traffic volume explains the spike.
5. Recent incidents have owner/action notes before expanding rollout.

### Promote from pilot to tiered

Only expand by plan tier when all of the following are true for at least 48 hours:

1. Widget error-event rate is below 3%.
2. No unexplained `message_error` or `invalid_token` spikes are present.
3. Pilot tenants have stable live traffic and no unresolved blocked-origin issues.
4. The force-disabled tenant list is empty or limited to known incidents with explicit owners.

### Promote from tiered to GA

Only switch to `ga` mode when:

1. Tiered tenants remain stable for at least 7 days.
2. Rollout-disabled incidents are zero for already-eligible tenants.
3. Recent incident feed shows no repeating unresolved pattern.
4. Rollback steps are documented: revert mode, reapply deny list, notify pilot tenants.

## Current Gaps to Close

- add dedicated webchat test suite to CI
- add distributed/shared rate limiter for multi-instance environments
- verify strict Origin + Referer enforcement policy in production
- add external telemetry dashboards/alerts for widget lifecycle events
