# Launch Offer Strategy: FOUNDING50

## Offer Details
- **Coupon Code**: `FOUNDING50`
- **Value**: 50% OFF
- **Eligibility**:
  - Annual plans only.
  - First 20 customers (enforced at Stripe level).
  - Valid for the first year only.

## Implementation Details
1. **Stripe Configuration**: Create a coupon `FOUNDING50` in Stripe with:
   - Duration: `repeating` (12 months) or `once` (if applying to the whole annual payment).
   - Percent off: 50%.
2. **Checkout Integration**:
   - The `/api/billing/checkout` route already supports `promoCode`.
   - Update the Pricing UI to highlight the offer for annual plans.
   - Validation: Ensure the coupon is only applied if `billingCycle === 'annual'`.
