# Meta & 3rd-Party Integrations Audit

**Date:** 2026-05-08
**Status:** **READY WITH COMPLIANCE CAUTIONS**
**Auditor:** Meta Platform Reviewer / Integrations Lead

## 1. Meta (Facebook/Messenger/Instagram)
*   **Token Management:** Access tokens are stored in the database. Ensure these are long-lived tokens, as short-lived tokens expire in hours. 
*   **24-Hour Policy:** Meta strictly enforces a 24-hour window for standard messaging. 
    *   *Risk:* ReplyBase must ensure it does not attempt to send promotional or automated follow-up messages outside of the 24-hour window, otherwise the Facebook App will be blocked.
*   **Webhook Resilience:** Meta requires a 200 OK response within seconds. The transition to BullMQ is excellent here, ensuring the immediate return of 200 OK while processing the message asynchronously.

## 2. WhatsApp Business API
*   **Risk:** WhatsApp pricing is conversation-based. A malfunctioning bot or flow loop can rack up massive bills on the Meta/Twilio side.
*   **Verdict:** Implement a strict rate limit per user per hour (e.g., max 50 messages/hour per contact) to prevent infinite loops between two bots talking to each other.

## 3. Plausible Analytics & Privacy
*   **Strengths:** Using Plausible provides cookie-less tracking, simplifying GDPR/CCPA compliance on the marketing frontend.
*   **Verdict:** Ensure that any future PostHog or Clarity integrations respect the user's "Do Not Track" signals or explicit cookie consent banners if deployed to European markets.
