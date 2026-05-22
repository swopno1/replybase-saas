# Payment & Stripe Integration Master Audit - ReplyBase (August 2026)

## 1. Subscription Architecture
- **Model**: Tiered SaaS with Starter (£29), Pro (£89), and Business tiers.
- **Sync**: Subscription status is mirrored in the `Subscription` table from Stripe Webhooks.
- **Gating**: Access to features (Bots, Flows, AI) is enforced via `lib/subscription.ts` using a cached lookup.

## 2. Stripe Webhook Integration
- **Reliability**: Webhooks are processed idempotently using the `StripeEvent` table.
- **Events Handled**:
  - `checkout.session.completed`: Initial subscription activation.
  - `customer.subscription.updated`: Plan changes and renewals.
  - `customer.subscription.deleted`: Immediate cancellation handling.
  - `invoice.paid`: Revenue tracking and record creation in `Revenue` table.
- **Security**: SHA256 signature verification enforced in `app/api/billing/webhook/route.ts`.

## 3. Billing UX & Flows
- **Checkout**: Next.js 15+ compatible Stripe Checkout sessions.
- **Customer Portal**: Direct integration with Stripe Billing Portal for self-service management (upgrades, downgrades, payment methods).
- **Downgrade Logic**: Implemented "Soft Downgrades" where users retain access until the end of the billing period, with Task 012 managing over-limit bot cleanup.
- **Usage Reset**: Automated monthly reset of message quotas via `cron/prune-logs`.

## 4. Financial Integrity
- **Revenue Tracking**: Automated persistence of successful payments into the `Revenue` table for internal analytics.
- **Refunds**: Currently handled manually via Stripe Dashboard; audit trail exists in Stripe Logs.
- **Failed Payments**: Automated retries via Stripe Smart Retries; app status updates to `PAST_DUE` automatically.

## 5. Billing Roadmap
1. **Metered Billing (LOW)**: Explore per-message overage charges for Business tiers.
2. **Usage Alerts (MEDIUM)**: Implement automated notifications when tenants reach 80% and 100% of their monthly quota.
3. **Advanced Tax Compliance (LOW)**: Integration with Stripe Tax for global VAT/GST handling.
