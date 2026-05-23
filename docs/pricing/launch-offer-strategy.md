# Launch Offer Strategy — FOUNDING50

To accelerate initial conversions and incentivize annual commitments, we have introduced the **Founding Offer** utilizing the promo code `FOUNDING50`.

---

## 1. Offer Specifications & Rules
The coupon is governed by the following strict promotional rules:
- **Discount Value**: 50% OFF the subscription price.
- **Billing Constraint**: Valid for **annual plans only**.
- **Onboarding Cap**: Restricted to the **first 20 customers**.
- **Duration**: Valid for the **first year of access** (12 months), reverting to full annual rates upon renewal.

---

## 2. Technical Implementation

### Stripe Coupon Settings
Create a coupon in the Stripe Dashboard with the following exact settings:
- **ID**: `FOUNDING50`
- **Name**: `Founding Member - 50% OFF Annual`
- **Percentage Off**: `50%`
- **Duration**: `Repeating` (with number of months set to `12`)
- **Redeems Limit**: `20` (enforces the "first 20 customers" rule natively inside Stripe)
- **Applies to**: Make sure to check the option to allow promotion codes, creating a promotion code string `FOUNDING50` linked to this coupon.

### Checkout API Integration
In `app/api/billing/checkout/route.ts`, the checkout handler automatically queries Stripe for active promotion codes matching "FOUNDING50" whenever an annual billing cycle is requested:

```typescript
if (billingCycle === "annual") {
  try {
    const promoCodes = await stripe.promotionCodes.list({
      code: "FOUNDING50",
      active: true,
      limit: 1,
    });
    if (promoCodes.data.length > 0) {
      checkoutOptions.discounts = [
        { promotion_code: promoCodes.data[0].id }
      ];
    }
  } catch (err) {
    console.error("Failed to apply FOUNDING50 coupon:", err);
  }
}
```

---

## 3. Webhook & Revenue Handling
No custom webhook handling is required for discounts because Stripe handles the math. The `stripe-worker` parses `invoice.payment_succeeded` and reads `invoice.amount_paid` (which will be exactly 50% of the annual price) and stores it in the `revenue` table:
$$\text{Revenue} = \text{Amount Paid} = (\text{Annual Price} \times 0.50)$$
This ensures that our analytics, KPIs, and dashboard statistics show accurate revenue numbers.

---

## 4. Upgrade Compatibility & Customer Portal
If a monthly customer attempts to upgrade to an annual plan using the customer portal, Stripe handles the proration calculation. However, Stripe Customer Portal does not support auto-applying promotion codes for upgrades. Users should be directed to request support or cancel and re-register if they wish to apply the `FOUNDING50` code on upgrades.
