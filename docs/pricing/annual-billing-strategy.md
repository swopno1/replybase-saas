# Annual Billing Strategy

This document details the strategy, implementation, and financial math behind the annual subscription options on the ReplyBase platform.

---

## 1. Rationale: "2 Months Free"
Annual contracts improve customer lifetime value (LTV), stabilize cash flows, and reduce churn rates. To incentivize users to select annual plans, we offer:
$$\text{Annual Price} = \text{Monthly Price} \times 10$$
This provides the customer with **12 months of access for the price of 10**, equivalent to **2 Months Free** (a **16.7% discount** off the standard monthly rate).

---

## 2. Plan Prices Math & Mappings

The prices are calculated in cents for Stripe operations:

### Launch
- **Monthly**: £29/month (`2900` cents)
- **Annual**: £290/year (`29000` cents)
- **Effective Monthly Rate**: £24.16/month (Saving £58/year)

### Grow
- **Monthly**: £49/month (`4900` cents)
- **Annual**: £490/year (`49000` cents)
- **Effective Monthly Rate**: £40.83/month (Saving £98/year)

### Scale
- **Monthly**: £89/month (`8900` cents)
- **Annual**: £890/year (`89000` cents)
- **Effective Monthly Rate**: £74.16/month (Saving £178/year)

### Business
- **Monthly**: £249/month (`24900` cents)
- **Annual**: £2490/year (`249000` cents)
- **Effective Monthly Rate**: £207.50/month (Saving £498/year)

---

## 3. UI Calculations & Presentation
In the dashboard pricing card (`app/(dashboard)/pricing/page.tsx`), the annual calculations are performed dynamically:
- **Effective Monthly Rate**: Billed price divided by 12:
  ```typescript
  const effectiveMonthly = billingCycle === "annual" ? Math.floor(displayPrice / 12) : displayPrice;
  ```
- **Annual Savings Callout**: Computes total savings:
  ```typescript
  const annualSavings = (plan.priceMonthly * 12 - plan.priceAnnual) / 100;
  // Billed £290 annually (Save £58)
  ```
- **Badge**: A clear `2 Months Free` badge is rendered next to the billing cycle toggle when annual mode is selected.
