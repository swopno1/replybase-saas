# Webchat Embed Quickstart

## 1) Add the embed script

```html
<script
  src="https://YOUR_REPLYBASE_DOMAIN/embed/replybase-webchat.js"
  data-base-url="https://YOUR_REPLYBASE_DOMAIN"
  data-channel-id="YOUR_WEB_CHANNEL_ID"
  data-title="Chat with ReplyBase"
  data-primary-color="#0f766e"
  data-position="right"
  defer
></script>
```

You can use `data-bot-id` instead of `data-channel-id`.

## 2) API routes used by the widget

- `POST /api/webchat/init`
- `GET /api/webchat/config`
- `POST /api/webchat/message`

## 3) CORS allowlist (optional)

By default, webchat routes allow all origins. To restrict origins, set:

```bash
WEBCHAT_ALLOWED_ORIGINS=https://example.com,https://www.example.com
```

## 4) Session token secret

Set one of:

- `WEBCHAT_TOKEN_SECRET`
- `AUTH_SECRET` (fallback)

## 5) One-time data normalization

If old channels used `"Web"`, run:

```bash
pnpm run normalize:web-channel-type
```
