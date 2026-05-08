# Subscription & Billing Flow Audit

**Date:** 2026-05-08
**Status:** **MEDIUM RISK**
**Auditor:** Stripe Billing Auditor

## 1. Subscription Lifecycle
*   **Flow:** Marketing Site -> Signup -> Onboarding -> Free Tier / Trial -> Stripe Checkout -> Webhook Sync.
*   **Strengths:** The recent migration of financial fields to `Int` (cents) eliminates floating-point rounding errors—a critical step for financial compliance. The `UsageBuffer` reduces write amplification.

## 2. Webhook Race Conditions
*   **Threat:** Stripe often fires multiple webhooks simultaneously (e.g., `invoice.payment_succeeded` and `customer.subscription.updated`). 
*   **Risk:** If the application processes these concurrently without database-level locks, it can result in duplicate revenue logs or corrupted subscription state.
*   **Verdict:** Ensure `lib/billing-service.ts` uses idempotency keys (like the Stripe Event ID) to silently drop duplicate/concurrent webhook processing.

## 3. Failed Payment & Downgrade Logic
*   **Threat:** A user on a premium plan has their credit card expire. Stripe retries for 7 days, then cancels the subscription.
*   **Risk:** Does ReplyBase immediately revoke premium access when `customer.subscription.deleted` arrives? Yes. However, what happens to the bots and channels they configured that exceed the Free tier limits?
*   **Verdict:** Implement a "Graceful Degradation" strategy. When downgraded, active flows should not break immediately; instead, pause execution and send a "Payment Failed - Bots Paused" email alert to the user.

## 4. Double Billing & Orphaned Subs
*   **Threat:** User clicks "Subscribe" multiple times resulting in multiple Checkout Sessions.
*   **Verdict:** Ensure the application checks if a user already has an active `stripeSubscriptionId` before generating a new Checkout Session. Prevent orphaned subscriptions by tracking session IDs locally.
