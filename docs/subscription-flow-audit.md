# Subscription & Billing Flow Audit: ReplyBase SaaS

## 1. Checkout & Signup Journey
### Status: **PASS**
- **Checkout Flow**: Uses Stripe Checkout for secure payment processing. Metadata (`tenantId`) is correctly passed and retrieved in the webhook.
- **Trial Handling**: Users can start a 14-day trial without a credit card. Trial expiration is monitored via `app/api/cron/expired-trials`.
- **Duplicate Prevention**: `app/api/billing/checkout/route.ts` checks for existing Stripe customers by email before creating new ones, preventing duplicate customer records in Stripe.

---

## 2. Webhook Reliability & Idempotency
### Status: **PASS (AUDITED)**
- **Signature Verification**: Mandatory Stripe signature check implemented in `app/api/billing/webhook/route.ts`.
- **Audit Log**: Every webhook event is logged to the `StripeEvent` table with a status (`PENDING`, `PROCESSED`, `FAILED`).
- **Idempotency**: The webhook handler checks the `StripeEvent` table for existing `PROCESSED` events before handling, preventing double-processing of duplicate webhooks.
- **Revenue Tracking**: `invoice.payment_succeeded` events are used to populate the `Revenue` table for internal analytics.

---

## 3. Subscription State Management
### Status: **CAUTION**
- **Sync Logic**: `lib/billing-service.ts` (`syncSubscription`) is the central source of truth for mapping Stripe states to database states.
- **State Mapping**:
  - `active`, `trialing` -> `ACTIVE` / `TRIALING`
  - `past_due` -> `PAST_DUE`
  - `unpaid`, `canceled`, `incomplete_expired` -> `CANCELED`
- **Cache Invalidation**: `invalidateTenantCache(tenantId)` is called after every sync, ensuring the middleware and UI see the latest status immediately.

### Critical Finding:
- **[High] Downgrade Limit Enforcement**:
  - When a user downgrades to a lower-tier plan, they may have more bots or channels than the new plan allows.
  - **Status**: The current logic (`handlePlanDowngrade` in `lib/subscription.ts`) identifies the surplus but doesn't automatically "suspend" them. It relies on the UI to disable "Create" buttons.
  - **Risk**: Existing bots/channels remain active and continue processing messages even if the new plan limit is exceeded.
  - **Remediation**: Implement an automated "soft-suspension" logic that disables the most recently created bots/channels until the count matches the new plan limits.

---

## 4. Edge Case Scenarios
- **Payment Failure**: Correctly handled via `invoice.payment_failed` webhook, setting status to `PAST_DUE`.
- **Refunds**: Handled via `charge.refunded`, immediately revoking access by setting status to `CANCELED`.
- **Subscription Cancellation**: Users can cancel via the Stripe Portal or dashboard. Access remains until the `currentPeriodEnd` (standard SaaS behavior).
- **Abandoned Checkout**: No logic currently exists to "nudge" users who abandon the Stripe Checkout page. *Action*: Consider a follow-up email after 24 hours of an incomplete checkout session.

---

## 5. Billing Action Plan
| Issue | Severity | Recommendation | Status |
| :--- | :--- | :--- | :--- |
| Over-limit Downgrade | High | Automatically disable surplus bots/channels on downgrade. | **PENDING** |
| Checkout Abandonment | Low | Implement abandoned checkout email recovery. | **BACKLOG** |
| Credit Management | Low | Add UI for "Credits" if moving to a per-message billing model. | **N/A (Fixed Plan)** |

**Audit Verdict**: The billing engine is robust and production-ready for standard operations. The primary risk is plan-limit bypass during downgrades, which should be addressed before the platform reaches high volume.
