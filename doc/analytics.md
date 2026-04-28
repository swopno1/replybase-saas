# Replybase Analytics Documentation

This document outlines the analytics setup for Replybase, specifically focusing on the integration of Plausible Analytics for secure, privacy-first, and reliable tracking

## Configuration

Analytics are strictly loaded only in the **production** environment (`process.env.NODE_ENV === 'production'`).

The following environment variables are used for configuration:

- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`: The domain name registered in Plausible (e.g., `app.replybase.co.uk`).
- `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC`: The URL of the Plausible script (defaults to `https://engine.replybase.co.uk/js/script.js`).

## Tracked Events

All custom events are tracked using the `trackEvent` utility in `lib/client-analytics.ts`.

### Event List

| Event ID | Plausible Goal Name | Description | Properties |
|----------|---------------------|-------------|------------|
| `signup_completed` | `signup` | Triggered when a user successfully completes signup. | `path`, `method`, `source`, `plan` |
| `onboarding_completed` | `onboarding_completed` | Triggered when all 4 major activation milestones are completed on the dashboard. | `path`, `tenant_id` |
| `first_message_sent` | `first_message_sent` | Triggered the first time a user sends a message via the Webchat widget in a session. | `url` |
| `subscription_started` | `subscription_started` | Triggered after a successful Stripe checkout redirect back to the dashboard. | `path`, `tenant_id`, `status` |

*Note: Other events like `signup_started` and `onboarding_step_completed` are tracked via Clarity/PostHog (if enabled) but are currently skipped for Plausible to focus on core conversion goals.*

## Technical Details

### Script Loading

The Plausible script is loaded using the Next.js `<Script>` component in `app/layout.tsx` (via `components/analytics/analytics-scripts.tsx`). It uses `async` and `defer` (via `strategy="afterInteractive"`) to avoid blocking the page rendering.

### Privacy & Compliance

- **Strict Production Check**: Analytics scripts only load when the hostname exactly matches `app.replybase.co.uk` and `NODE_ENV` is `production`.
- **GDPR Compliance**: Plausible Analytics is GDPR-compliant by design as it does not use cookies and does not track personal data.
- **Anonymization**: All data is anonymized. No IP addresses or personal identifiers are stored.
- **Client-Side Safety**: No API keys or secrets are exposed to the client. The self-hosted instance at `engine.replybase.co.uk` is used.

### Error Handling

The `trackEvent` utility includes `try...catch` blocks for each analytics provider (Plausible, Clarity, PostHog) to ensure that a failure in one does not affect the application's functionality or other tracking. Failed script loads are also logged to the console in production.

## Implementation Example

To track a new event, use the `trackEvent` function from `@/lib/client-analytics`:

```typescript
import { trackEvent } from "@/lib/client-analytics";

// ... inside a client component
trackEvent("newsletter_signup", {
  properties: {
    source: "footer",
  },
});
```
