# Payment, Billing & Stripe Inspection Report - ReplyBase SaaS (Updated August 2026)

## 1. Billing Lifecycle Integrity
- **Checkout Flow**: Handled via `app/api/billing/checkout/route.ts`. Uses Stripe Checkout with `tenantId` passed in `metadata` for reliable sync.
- **Subscription Sync**: Centralized in `lib/billing-service.ts` via `syncSubscription`. Handles plan mapping, trial status, and period alignment.
- **Status Mapping**: Stripe statuses (`active`, `trialing`, `past_due`, `canceled`) are accurately mapped to internal subscription states.

## 2. Webhook Reliability & Edge Cases
- **Idempotency**: All Stripe webhooks are logged in `StripeEvent` and checked for "PROCESSED" status before execution.
- **Refund Handling**: `charge.refunded` event correctly revokes subscription status (sets to `CANCELED`).
- **Payment Failures**: `invoice.payment_failed` correctly transitions subscriptions to `PAST_DUE`, triggering in-app billing prompts.
- **Downgrade Logic**: `handlePlanDowngrade` in `lib/subscription.ts` proactively deactivates excess bots and channels when a user moves to a lower tier.

## 3. Quota & Limit Enforcement
- **Real-time Gating**: `checkLimit` and `checkBotLimit` utilities provide millisecond-latency enforcement for AI and bot creation.
- **Usage Buffering**: `UsageBuffer` prevents database write-lock contention during high-volume messaging spikes by batching usage increments.
- **Notification Triggers**: Automated alerts at 90%, 100%, and 110% usage are implemented via `ActivityLog` and Email.

## 4. Billing UX Analysis
- **Trial Awareness**: Dashboard clearly displays "Days Remaining" and provides a "Choose Plan" CTA when the trial window is closing (< 10 days).
- **Transparency**: Invoices are fetched in real-time from Stripe and displayed in the Billing settings tab.
- **Friction**: Minimal. Pricing is clear, and the transition from trial to paid is frictionless via Stripe Customer Portal.

## 5. Operational Risks
- **Webhook Latency**: High volume of concurrent `invoice.payment_succeeded` could create a queue backlog. **Mitigation**: Webhook logic is lightweight; heavy processing is async.
- **Subscription Drift**: Potential for DB/Stripe mismatch if webhooks are missed. **Mitigation**: `reconcileSubscriptions` daily cron job.

## 6. Improvement Roadmap
1. **Failed Payment Recovery**: Implement automated "Payment Recovery" emails with discount codes for users in `PAST_DUE` for > 3 days.
2. **Usage Analytics**: Provide users with a visual "Usage Forecast" based on current consumption rates.
3. **Proration Clarity**: Improve the UI during mid-cycle upgrades to show exact proration amounts before redirection to Stripe.
