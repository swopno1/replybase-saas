# Stripe Migration Plan

## 1. Environment Variable Update
Introduce new Price IDs for annual plans:
- `NEXT_PUBLIC_STRIPE_LAUNCH_ANNUAL_PRICE_ID`
- `NEXT_PUBLIC_STRIPE_GROW_ANNUAL_PRICE_ID`
- `NEXT_PUBLIC_STRIPE_SCALE_ANNUAL_PRICE_ID`
- `NEXT_PUBLIC_STRIPE_BUSINESS_ANNUAL_PRICE_ID`

## 2. Product/Price Configuration
- Create 4 new Products in Stripe (Launch, Grow, Scale, Business).
- Create 2 Prices for each: Monthly and Annual.
- Annual price = Monthly price * 10.

## 3. Checkout Flow Enhancements
- Update `/api/billing/checkout` to accept `billingCycle` (monthly|annual).
- Enforce `FOUNDING50` coupon check for annual plans.

## 4. Subscription Management
- Ensure webhook handler (`/api/billing/webhook`) correctly maps incoming Stripe plan IDs back to the internal plan names.
