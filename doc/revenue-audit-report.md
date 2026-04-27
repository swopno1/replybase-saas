# Revenue Tracking Audit & Implementation Report

## Current State & Identified Gaps
Previously, the ReplyBase Admin Dashboard estimated "Monthly Revenue" by summing the prices of all active subscriptions. This approach had several flaws:
- **Accuracy:** It didn't account for failed payments, refunds, or partial payments.
- **Admin Overrides:** Manually granting "active" status or changing plans for a tenant would falsely inflate revenue metrics.
- **Real-time Data:** There was no record of historical payments, making it impossible to track growth over time accurately.

## Proposed Data Model
We introduced a `Revenue` model to the Prisma schema to store actual payment events from Stripe.

### `Revenue` Model
- `id`: Unique identifier (CUID).
- `stripeInvoiceId`: Unique Stripe Invoice ID to prevent duplicate recording.
- `stripeSubscriptionId`: The subscription this payment belongs to.
- `tenantId`: Relation to the `Tenant`.
- `amount`: The actual amount paid (converted from cents).
- `currency`: Payment currency (e.g., USD, GBP).
- `status`: Payment status (e.g., "paid").
- `paidAt`: Timestamp of the payment.
- `metadata`: Flexible JSON for storing invoice URLs or other Stripe data.

## Implementation Details

### 1. Stripe Webhook Enhancement
The webhook handler in `app/api/billing/webhook/route.ts` was updated to handle the `invoice.paid` event.
- When an invoice is paid, the system looks up the `tenantId` via the `stripeCustomerId` stored in the `Subscription` table.
- A new `Revenue` record is created with the actual paid amount.
- This ensures that only real money entering the system is counted as revenue.

### 2. Admin Dashboard Update
The Business Overview dashboard in `app/(admin)/admin/page.tsx` now uses the `Revenue` table.
- **Monthly Revenue:** Calculated by summing `amount` from the `Revenue` table where `paidAt` is within the last 30 days.
- **Revenue Details Table:** A new comprehensive table providing transparency:
    - **Tenant / User:** Identifies who paid.
    - **Stripe ID:** Direct link to the Stripe subscription.
    - **Monthly Amount:** The recurring plan price.
    - **Last Paid:** Date of the most recent successful payment.
    - **Status:** Current subscription status.
    - **Total Paid:** Lifetime value (LTV) for the tenant.

## Testing Requirements
- **Webhook Validation:** A script `scripts/test-stripe-webhook.ts` was created to simulate Stripe events and verify database integrity.
- **Manual Verification:** The Admin Dashboard UI was checked to ensure it correctly displays data from the `Revenue` table.
- **Regression Testing:** Existing test suites were run to ensure no disruption to core billing or admin logic.

## Migration & Data Backfill
- **New Revenue:** All future payments will be captured automatically.
- **Backfill (Optional):** To populate historical data, a one-time script can be run to iterate through past Stripe invoices and create `Revenue` records for them.
