# Payment & Stripe Audit Report

## Core Integration
- **Provider**: Stripe (Node.js SDK).
- **Mode**: Subscription-based (Starter, Pro, Business).
- **Checkout**: Stripe Hosted Checkout for secure payment processing.
- **Portal**: Stripe Customer Portal for subscription management.

## Webhook Handling
- **Endpoint**: `/api/billing/webhook`.
- **Hardening**: Signature verification using `STRIPE_WEBHOOK_SECRET`.
- **Events**:
  - `checkout.session.completed`: Activates trial/subscription.
  - `customer.subscription.updated`: Syncs plan changes.
  - `customer.subscription.deleted`: Handles cancellations and downgrades to Free.
  - `invoice.payment_failed`: Triggers "Past Due" status and UI alerts.

## Billing UX
- **Transparency**: Clear plan comparison in `/pricing`.
- **Ease of Use**: One-click "Manage Billing" via Stripe Portal.
- **Recovery**: Past-due banners encourage immediate payment resolution.

## Risks
- **Webhook Desync**: If a webhook fails and isn't retried, the DB may fall out of sync with Stripe.
- **Remediation**: Daily `reconcileSubscriptions()` cron job ensures eventual consistency.
