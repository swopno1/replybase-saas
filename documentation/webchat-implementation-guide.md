---
title: Webchat Implementation Guide
description: Current architecture and practical implementation guide for ReplyBase Webchat
---

# Webchat Implementation Guide

## Scope

This guide documents how the current webchat implementation works in code, what is already production-usable, and what is still planned.

## Current Architecture

### Runtime components

- Public widget script: `public/embed/replybase-webchat.js`
- Public APIs:
  - `POST /api/webchat/init`
  - `GET /api/webchat/config`
  - `POST /api/webchat/message`
  - `POST /api/webchat/events`
- Session token utility: `lib/webchat-session.ts`
- Channel/session resolution utility: `lib/webchat.ts`
- CORS utility: `lib/webchat-cors.ts`
- AI pipeline integration: `lib/ai-engine.ts`

### Data storage (current)

Dedicated webchat tables now exist:

- `WebChatSite` for site-level identity and config (`publicKey`, `secretKey`, domains, theme)
- `WebChatSession` for visitor-session continuity
- `WebChatEvent` for diagnostics/audit events

CRM continuity remains in place and is still used:

- `Channel` for channel metadata/config
- `Contact` + `ContactIdentity` for visitor identity
- `CrmConversation` for conversation continuity
- `CrmMessage` for transcript persistence

## Request Flows

### 1) Session Initialization

Widget calls `POST /api/webchat/init` with `publicKey` (preferred) or `channelId` / `botId`.

Server flow:

1. Validate CORS/origin policy.
2. Resolve site by `publicKey`, or resolve active web channel and create/reuse `WebChatSite`.
3. Enforce site domain allowlist (`allowedDomains`) using Origin/Referer.
4. Resolve or create visitor contact + CRM conversation + `WebChatSession`.
5. Issue signed session token (24h default).
6. Record `INIT` telemetry event and return token + conversation/site/session context.

### 2) Config Fetch

Widget calls `GET /api/webchat/config` with `publicKey` (preferred) or `channelId` / `botId`.

Server flow:

1. Validate CORS/origin policy.
2. Resolve site by `publicKey`, or resolve active web channel and create/reuse site.
3. Enforce site domain allowlist and return safe config from `WebChatSite.themeConfig`.

### 3) Message Send

Widget calls `POST /api/webchat/message` with session token + message.

Server flow:

1. Validate CORS/origin policy.
2. Verify signed token and expiry.
3. Verify conversation ownership (`botId`, `channel=web`).
4. Call `converse(...)`.
5. Persist inbound and outbound CRM messages.
6. Update `WebChatSession` continuity fields and record a `MESSAGE` event.
7. Return normalized response payload.

### 4) Client Telemetry

Widget calls `POST /api/webchat/events` for lifecycle signals.

Server flow:

1. Validate CORS/origin policy.
2. Verify session token and resolve site.
3. Enforce site domain allowlist.
4. Persist event (`OPEN`, `CLOSE`, `TYPING`, `ERROR`, `MESSAGE`) to `WebChatEvent`.
5. Touch `WebChatSession.lastSeenAt` when a matching session exists.

## Dashboard Setup Flow

Path: `/integrations/webchat`

Capabilities:

- Select bot
- Create/select web channel
- Set channel name
- Set widget title/color/position/welcome text
- Save channel config
- Generate and copy embed snippet
- Live preview with interactive send simulation

## Environment Variables

Required/used by webchat runtime:

- `WEBCHAT_TOKEN_SECRET` (recommended)
- `AUTH_SECRET` (fallback secret for token signing)
- `WEBCHAT_ALLOWED_ORIGINS` (optional allowlist, comma-separated)

Optional rate-limit tuning:

- `WEBCHAT_RATE_LIMIT_INIT_IP`
- `WEBCHAT_RATE_LIMIT_INIT_WINDOW_MS`
- `WEBCHAT_RATE_LIMIT_MESSAGE_IP`
- `WEBCHAT_RATE_LIMIT_MESSAGE_WINDOW_MS`
- `WEBCHAT_RATE_LIMIT_MESSAGE_SESSION`
- `WEBCHAT_RATE_LIMIT_MESSAGE_SESSION_WINDOW_MS`
- `WEBCHAT_RATE_LIMIT_EVENTS_IP`
- `WEBCHAT_RATE_LIMIT_EVENTS_WINDOW_MS`
- `WEBCHAT_RATE_LIMIT_EVENTS_SESSION`
- `WEBCHAT_RATE_LIMIT_EVENTS_SESSION_WINDOW_MS`

## Security Notes (Current)

Implemented:

- HMAC-signed session tokens with expiry.
- Origin-based CORS controls for webchat routes.
- IP and session-based rate limiting for `init`, `message`, and `events`.

Still recommended:

- explicit Referer validation policy
- no wildcard origin in production
- abuse mitigation controls

## Known Gaps

- Key lifecycle management UX (`publicKey` / `secretKey` rotation) is still pending.
- No webchat-specific automated test suite yet.

## Upgrade Path (Next)

1. Add dashboard key/domain management UX for `WebChatSite`.
2. Add diagnostics views for telemetry and blocked-origin events.
3. Add test matrix (unit/integration/e2e) and feature-flagged rollout.
