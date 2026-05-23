# Stripe Migration Plan

This document outlines the operational roadmap to align our Stripe products, prices, checkouts, and webhooks with the new **Launch, Grow, Scale, Business** pricing structures.

---

## 1. Environment Variable Mapping
Configure the following keys in your development and production environments:

```env
# Monthly Price IDs
NEXT_PUBLIC_STRIPE_LAUNCH_PRICE_ID=price_1Ta9FHJlpKwK1y1z1rVRNNmt
NEXT_PUBLIC_STRIPE_GROW_PRICE_ID=price_1Ta9TNJlpKwK1y1zUPk3Fi8U
NEXT_PUBLIC_STRIPE_SCALE_PRICE_ID=price_1Ta9UcJlpKwK1y1z4Xqln3FA
NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID=price_1Ta9VcJlpKwK1y1zUUbJOxp5

# Annual Price IDs (10 Months Value)
NEXT_PUBLIC_STRIPE_LAUNCH_ANNUAL_PRICE_ID=price_1Ta9QuJlpKwK1y1z0FfBJeyc
NEXT_PUBLIC_STRIPE_GROW_ANNUAL_PRICE_ID=price_1Ta9TNJlpKwK1y1z0n04Ue1o
NEXT_PUBLIC_STRIPE_SCALE_ANNUAL_PRICE_ID=price_1Ta9UcJlpKwK1y1zPK4Zdq1y
NEXT_PUBLIC_STRIPE_BUSINESS_ANNUAL_PRICE_ID=price_1Ta9VcJlpKwK1y1zFfpFjmm7

# Legacy Aliases (Must be kept in production for backward compatibility)
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_1Ta9FHJlpKwK1y1z1rVRNNmt
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_1Ta9UcJlpKwK1y1z4Xqln3FA
```

---

## 2. Product and Price Setup (Stripe Dashboard)
To migrate prices:
1. Log into your Stripe Dashboard (or use Test Mode).
2. Create/Update 4 Products named:
   - `ReplyBase Launch`
   - `ReplyBase Grow`
   - `ReplyBase Scale`
   - `ReplyBase Business`
3. Under each product, create two prices:
   - **Monthly Price**: £29, £49, £89, or £249 (Recurring monthly).
   - **Annual Price**: £290, £490, £890, or £2490 (Recurring yearly).
4. Run the Stripe product seeding script:
   ```bash
   npm run seed:stripe
   ```
   This script verifies/creates products and prices in Stripe and updates the limits inside the local database `plans` table.

---

## 3. Webhook Integration Flow
ReplyBase uses a queue-based system to process Stripe events:
- Stripe delivers webhook requests to `/api/billing/webhook`.
- Webhooks verify signatures using `STRIPE_WEBHOOK_SECRET`.
- The webhook enqueues a job (`stripe-event`) in Redis.
- Background worker `stripe-worker.ts` processes the job and synchronizes data with the DB via `syncSubscription` in `lib/billing-service.ts`.

### Webhook Action Mapping
- `checkout.session.completed`: Sets up subscription linking to the tenant.
- `customer.subscription.created` & `customer.subscription.updated`: Resolves plans and updates limits.
- `customer.subscription.deleted`: Revokes limits and sets plan back to `Free`.
- `invoice.payment_succeeded`: Inserts a revenue record in the `revenue` table.
- `invoice.payment_failed`: Marks subscription as `PAST_DUE`.

---

## 4. Stripe Customer Portal Configuration
Ensure the Customer Portal is enabled in your Stripe Dashboard settings:
- Go to **Settings > Billing > Customer Portal**.
- Allow customers to upgrade, downgrade, or cancel subscriptions.
- Set the redirection URL to `https://app.replybase.co.uk/settings?tab=billing`.
- Ensure all 8 price IDs (monthly and annual) are added to the list of allowed products in the portal settings so users can self-migrate between tiers.
