# Replybase Analytics Documentation

This document outlines the analytics setup for Replybase, specifically focusing on the integration of Plausible Analytics for secure, privacy-first, and reliable tracking.

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
| `get_started_click` | `Get Started Click` | Triggered when a user clicks a "Get Started" or similar CTA. | `path` (current URL path) |
| `signup_started` | - | Triggered when a user starts the signup process. | `path` |
| `signup_completed` | `Signup Completed` | Triggered when a user successfully completes signup. | `path` |
| `onboarding_step_completed` | - | Triggered when a user completes a step in the onboarding flow. | `path`, `step_name` |
| `dashboard_loaded` | - | Triggered when the main dashboard is loaded. | `path` |
| `pricing_viewed` | `Pricing Viewed` | Triggered when a user views the pricing section or page. | `path` |
| `newsletter_signup` | `Newsletter Signup` | Triggered when a user signs up for the newsletter. | `path`, `email` (optional) |
| `contact_form_submission` | `Contact Form Submission` | Triggered when a user submits a contact form. | `path`, `form_id` |

## Technical Details

### Script Loading

The Plausible script is loaded using the Next.js `<Script>` component in `app/layout.tsx` (via `components/analytics/analytics-scripts.tsx`). It uses `async` and `defer` (via `strategy="afterInteractive"`) to avoid blocking the page rendering.

### Privacy & Compliance

- **GDPR Compliance**: Plausible Analytics is GDPR-compliant by design as it does not use cookies and does not track personal data.
- **Anonymization**: All data is anonymized. No IP addresses or personal identifiers are stored.
- **Client-Side Safety**: No API keys or secrets are exposed to the client.

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
