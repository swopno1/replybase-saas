# Webchat Embed Quickstart

## 1) Add the embed script

```html
<script
  src="https://YOUR_REPLYBASE_DOMAIN/embed/replybase-webchat.js"
  data-base-url="https://YOUR_REPLYBASE_DOMAIN"
  data-public-key="YOUR_WEBCHAT_PUBLIC_KEY"
  data-channel-id="YOUR_WEB_CHANNEL_ID"
  data-title="Chat with ReplyBase"
  data-primary-color="#0f766e"
  data-position="right"
  defer
></script>
```

Use one targeting option:

- Preferred: `data-public-key`
- Fallback: `data-channel-id`
- Fallback: `data-bot-id`

Dashboard snippet generation now prefers `data-public-key` when the site record is available, with `data-channel-id` as a fallback.

## 2) API routes used by the widget

- `POST /api/webchat/init`
- `GET /api/webchat/config`
- `POST /api/webchat/message`
- `POST /api/webchat/events`

## 3) CORS allowlist (optional)

By default, webchat routes allow all origins. To restrict origins, set:

```bash
WEBCHAT_ALLOWED_ORIGINS=https://example.com,https://www.example.com
```

## 4) Session token secret

Set one of:

- `WEBCHAT_TOKEN_SECRET`
- `AUTH_SECRET` (fallback)

## 5) Rate limiting knobs (optional)

```bash
WEBCHAT_RATE_LIMIT_INIT_IP=20
WEBCHAT_RATE_LIMIT_INIT_WINDOW_MS=60000
WEBCHAT_RATE_LIMIT_MESSAGE_IP=120
WEBCHAT_RATE_LIMIT_MESSAGE_WINDOW_MS=60000
WEBCHAT_RATE_LIMIT_MESSAGE_SESSION=60
WEBCHAT_RATE_LIMIT_MESSAGE_SESSION_WINDOW_MS=60000
WEBCHAT_RATE_LIMIT_EVENTS_IP=240
WEBCHAT_RATE_LIMIT_EVENTS_WINDOW_MS=60000
WEBCHAT_RATE_LIMIT_EVENTS_SESSION=180
WEBCHAT_RATE_LIMIT_EVENTS_SESSION_WINDOW_MS=60000
```

## 6) One-time data normalization

If legacy channels used mixed-case channel types (for example `"Web"`), run:

```bash
pnpm run normalize:web-channel-type
```
