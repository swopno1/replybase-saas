# Replybase Analytics Documentation

This document outlines the analytics setup for Replybase, specifically focusing on the integration of **Plausible Analytics** for secure, privacy-first, and reliable tracking.

## Configuration & Deployment

Analytics are strictly loaded **only in the production environment** (`process.env.NODE_ENV === 'production'`) and exclusively on the official production domain (`app.replybase.co.uk`).

The implementation uses a self-hosted instance to avoid exposing API keys or secrets to the client. The following environment variables are required for configuration:

- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`: The domain name registered in Plausible (e.g., `app.replybase.co.uk`).
- `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC`: The URL of the Plausible script (defaults to `https://engine.replybase.co.uk/js/script.js`).

### Script Loading
The Plausible script is integrated using the Next.js `<Script>` component within `app/layout.tsx` (via the `components/analytics/analytics-scripts.tsx` wrapper). To ensure application performance is unimpacted, the script uses the `strategy="afterInteractive"` approach for non-blocking execution alongside the `defer` attribute.

## Privacy & Compliance

Our analytics approach strictly adheres to a **Privacy-First** philosophy and is fully **GDPR-compliant**:

- **No Cookies:** Plausible operates without using tracking cookies.
- **No Personal Data:** Analytics tracking strictly excludes personally identifiable information (PII).
- **No IP Address Storage:** User IP addresses are not stored or persisted in any form.
- **Anonymization:** All custom event properties are sanitized and anonymized before dispatch (e.g., `tenant_id` instead of emails).
- **Client-Side Safety:** API keys or secrets are never exposed on the client. All event tracking endpoints use the self-hosted instance (`engine.replybase.co.uk`).

## Event Tracking

All custom application events are recorded using the unified `trackEvent` utility imported from `@/lib/client-analytics`.

### Core Tracked Events

The following core business objectives are tracked and mapped directly to Plausible Goals:

| Event ID | Plausible Goal Name | Description | Example Properties |
|----------|---------------------|-------------|---------------------|
| `signup_completed` | `signup` | Triggered when a user successfully completes signup (e.g., via OAuth). | `method`, `source`, `plan`, `path` |
| `onboarding_completed` | `onboarding_completed` | Triggered when all major activation milestones are completed on the dashboard. | `tenant_id`, `path` |
| `first_message_sent` | `first_message_sent` | Triggered the first time a user sends a message in a session. | `url`, `path` |
| `subscription_started` | `subscription_started` | Triggered after a successful Stripe checkout redirect back to the dashboard. | `status`, `tenant_id`, `path` |

*Note: Other secondary events (like `signup_started` and `onboarding_step_completed`) are processed by the tracker utility but are currently filtered out for Plausible to maintain focus purely on core conversion metrics.*

## Error Handling

The application is resilient against analytics failures:
- **Provider Isolation**: Within `trackEvent`, each analytics provider (including Plausible) is enclosed in a dedicated `try...catch` block. This guarantees that an integration failure will **never block or crash** the core application functionality.
- **Non-blocking failures**: Script load failures trigger the `onError` handler on the Next.js `<Script>` tag, which gracefully logs the error to the console in production without disrupting the user experience.

## Implementation Example

To track an event within a React Client Component, import and use the `trackEvent` utility:

```typescript
"use client";

import { trackEvent } from "@/lib/client-analytics";

export function UpgradeButton() {
  const handleUpgrade = () => {
    trackEvent("subscription_started", {
      properties: {
        plan: "pro",
        source: "dashboard_banner"
      },
      // Optional: Prevent duplicate tracking across a session or locally
      onceKey: "subscription_started_pro",
      onceScope: "session",
    });

    // Proceed with business logic...
  };

  return <button onClick={handleUpgrade}>Upgrade Now</button>;
}
```
