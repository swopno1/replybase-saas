# Meta Integration Maintenance Guide

This document outlines the process for maintaining and updating the Meta (Facebook/WhatsApp) integration in ReplyBase.

## API Version Updates

Meta typically releases a new version of the Graph API every 3 months and sunsets older versions after approximately 2 years.

### How to Update the API Version

1.  **Central Version:** Update `FACEBOOK_GRAPH_API_VERSION` in `lib/meta-config.ts`.
2.  **Compatibility Testing:**
    *   Run the automated security suite: `pnpm test tests/facebook-hardening.test.ts`
    *   Run the core messaging tests: `pnpm test tests/lib/conversation-channel-delivery.test.ts`
    *   Manually verify the "Check Connection" diagnostic button in the Integration dashboard for a connected page.
3.  **App Review:** If upgrading across major versions (e.g., v21.0 to v25.0), check Meta's [Changelog](https://developers.facebook.com/docs/graph-api/changelog) for breaking changes in permissions or webhook payloads.

## Security Requirements

All calls to Meta's Graph API **must** include:
1.  A valid `access_token`.
2.  An `appsecret_proof` generated using the app's client secret.

Use the `getFacebookGraphUrl` utility in `lib/server/facebook-utils.ts` to ensure these parameters are automatically appended.

## Data Deletion

Meta requires a mandatory data deletion callback. ReplyBase handles this via:
1.  **Callback Endpoint:** `/api/facebook/data-deletion` (processes the `signed_request`).
2.  **Status Page:** `/data-deletion-status` (provides transparency to users).
3.  **Cron Job:** `/api/cron/process-data-deletions` (executes actual data scrubbing).

Ensure the Cron job is scheduled to run at least daily in production.
