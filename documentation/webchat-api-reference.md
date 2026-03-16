---
title: Webchat API Reference
description: Request and response contracts for ReplyBase webchat public API endpoints
---

# Webchat API Reference

Base path: `/api/webchat`

## Common Behavior

- CORS is enforced via webchat allowlist logic.
- `OPTIONS` is supported for preflight on each endpoint.
- JSON responses are returned for success and errors.

## POST `/api/webchat/init`

Initialize or restore a visitor session.

Important: call `GET /api/webchat/config` first and pass the returned `initChallenge.token` into `init`.

### Request body

```json
{
  "publicKey": "optional-site-public-key",
  "channelId": "optional-channel-id",
  "botId": "optional-bot-id",
  "initChallenge": "signed-one-time-config-issued-challenge",
  "origin": "https://site.example",
  "visitorId": "optional-sticky-visitor-id",
  "visitorContext": {
    "name": "optional",
    "email": "optional@example.com",
    "phone": "optional"
  },
  "contact": {
    "name": "optional",
    "email": "optional@example.com",
    "phone": "optional"
  },
  "metadata": {
    "url": "https://site.example/page",
    "referrer": "https://google.com"
  },
  "botSignals": {
    "honeypot": "",
    "elapsedMs": 1200
  }
}
```

Rules:

- At least one of `publicKey`, `channelId`, or `botId` is required.
- `initChallenge` is required and is single-use within its replay window.
- `visitorContext` and `contact` are both accepted for contact enrichment.
- `botSignals.honeypot` must remain empty.
- `botSignals.elapsedMs` is used for bot-mitigation checks on init.

### Success response

```json
{
  "token": "signed-session-token",
  "visitorId": "visitor-id",
  "conversationId": "crm-conversation-id",
  "webChatSessionId": "webchat-session-id",
  "channelId": "channel-id",
  "botId": "bot-id",
  "siteId": "webchat-site-id",
  "publicKey": "wpk_xxx",
  "config": {
    "title": "Chat with us",
    "primaryColor": "#0f766e"
  },
  "expiresIn": 86400
}
```

### Error responses

- `400` invalid request
- `403` origin not allowed
- `404` active web channel not found
- `429` rate limit exceeded
- `500` server failure

## GET `/api/webchat/config`

Get public widget config.

### Query params

- `publicKey` or `channelId` or `botId` (one required)

### Success response

```json
{
  "channelId": "channel-id",
  "botId": "bot-id",
  "siteId": "webchat-site-id",
  "publicKey": "wpk_xxx",
  "initChallenge": {
    "token": "signed-one-time-init-token",
    "expiresIn": 300
  },
  "telemetry": {
    "taxonomyVersion": "2026-03-16",
    "sampleRates": {
      "OPEN": 1,
      "CLOSE": 1,
      "TYPING": 0.25,
      "MESSAGE": 1,
      "ERROR": 1
    }
  },
  "config": {
    "title": "Chat with us",
    "primaryColor": "#0f766e",
    "welcomeMessage": "Hi. How can I help you today?",
    "position": "right"
  }
}
```

### Error responses

- `400` missing query params
- `403` origin not allowed
- `404` active web channel not found
- `500` server failure

## POST `/api/webchat/message`

Send a visitor message and receive assistant responses.

### Request body

```json
{
  "token": "signed-session-token",
  "message": "Hello",
  "metadata": {
    "pageUrl": "https://site.example/pricing?utm_source=google",
    "referrer": "https://google.com",
    "locale": "en-US",
    "pageTitle": "Pricing",
    "origin": "https://site.example",
    "utmSource": "google",
    "utmMedium": "cpc",
    "utmCampaign": "brand"
  },
  "botSignals": {
    "honeypot": "",
    "elapsedMs": 3000
  }
}
```

### Success response

```json
{
  "conversationId": "crm-conversation-id",
  "sessionId": "external-engine-session-id",
  "responses": [{ "type": "text", "text": "Hello, how can I help?" }],
  "meta": {
    "mode": "flow",
    "sourceContext": {
      "pageUrl": "https://site.example/pricing?utm_source=google",
      "referrer": "https://google.com",
      "locale": "en-US"
    }
  }
}
```

### Error responses

- `400` invalid request
- `401` invalid session token
- `403` origin not allowed
- `404` conversation not found/invalid ownership
- `429` rate limit exceeded
- `503` upstream AI unavailable
- `500` server failure

Notes:

- `meta.mode` can be `flow`, `ai`, or `safe_fallback`.
- When the AI engine is unavailable, the webchat route now returns safe fallback text instead of surfacing raw engine failure copy to the visitor.

## POST `/api/webchat/events`

Ingest widget telemetry events.

### Request body

```json
{
  "token": "signed-session-token",
  "type": "OPEN",
  "payload": {
    "url": "https://site.example/page",
    "trigger": "launcher"
  }
}
```

Supported `type` values: `OPEN`, `CLOSE`, `TYPING`, `ERROR`, `MESSAGE`.

### Success response

```json
{
  "ok": true,
  "sampled": true,
  "sampleRate": 1
}
```

### Error responses

- `400` invalid request
- `401` invalid session token
- `403` origin not allowed
- `404` webchat site not found
- `429` rate limit exceeded
- `500` server failure

## CORS / Preflight

All endpoints support:

- `OPTIONS /api/webchat/init`
- `OPTIONS /api/webchat/config`
- `OPTIONS /api/webchat/message`
- `OPTIONS /api/webchat/events`

## Security Contract

- Session token must be signed and unexpired.
- Init challenge must be signed, unexpired, site-bound, and single-use.
- Token must map to the expected conversation/bot context.
- Origin policy follows `WEBCHAT_ALLOWED_ORIGINS`.
- Rate limiting is enforced per IP and per session key on public write endpoints.
- Bot mitigation checks can block suspicious init/message requests.
- PII retention is controlled by `WEBCHAT_PII_RETENTION_MODE` (`retain`, `mask`, `drop`).

## Rate Limit Headers

When throttling is active, responses may include:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `Retry-After`

## Persistence Notes

- `init` currently upserts `WebChatSite` and `WebChatSession` records.
- `message` updates `WebChatSession.lastSeenAt` and `externalSessionId`.
- `events` records `OPEN`/`CLOSE`/`TYPING`/`ERROR`/`MESSAGE` telemetry in `WebChatEvent`.
- `init` records `INIT` and `message` records `MESSAGE` server-side events.
- `events` payloads are normalized under a server-side telemetry taxonomy and may be sampled for high-volume signals such as `TYPING`.
