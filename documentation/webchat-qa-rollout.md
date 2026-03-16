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

## Recommended Metrics

Track at minimum:

- init success rate
- message success rate
- message latency p50/p95
- AI error rate
- blocked origin count
- invalid token count

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

## Current Gaps to Close

- add dedicated webchat test suite to CI
- add telemetry dashboards/alerts for widget lifecycle events
- add dashboard diagnostics panel for runtime issues
