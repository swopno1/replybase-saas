
# Financial Precision & Security Refactor - Risk Checklist

## 1. Stripe Plan Sync
- **Risk:** Existing subscriptions on Stripe might have different Price IDs than what's in `lib/stripe.ts` if environment variables are not updated.
- **Mitigation:** Ensure `NEXT_PUBLIC_STRIPE_*_PRICE_ID` environment variables match exactly what's on the Stripe Dashboard.
- **Action:** Verify plan sync logic in `syncSubscription` handles unknown plan names gracefully by reverting to 'free'.

## 2. Floating Point Precision in Reports
- **Risk:** Although DB storage is now `Int`, historical calculations in the frontend or legacy scripts might still use `Float` division, potentially re-introducing rounding issues during aggregation.
- **Mitigation:** Always use `Int` for aggregation in Prisma (`_sum`) and only divide by 100 at the final display layer.
- **Verification:** Verified `app/(admin)/admin/page.tsx` follows this pattern.

## 3. Webhook Idempotency
- **Risk:** `invoice.payment_succeeded` could trigger multiple times for the same invoice, potentially double-counting revenue.
- **Mitigation:** Implemented `prisma.revenue.upsert` with `stripeInvoiceId` as the unique constraint.
- **Verification:** Verified `Revenue` model in `schema.prisma` has `@unique` on `stripeInvoiceId`.

## 4. Middleware (proxy.ts) Coverage
- **Risk:** New API routes or dashboard pages might be added that don't match the current `proxy.ts` prefix-based logic.
- **Mitigation:** Implemented a explicit `isProtectedPath` check and a `default-deny` strategy for unauthenticated users.
- **Action:** Regularly review the `isPublicPath` allow-list to ensure it doesn't leak sensitive data.

## 5. Migration Downtime
- **Risk:** Changing column types from `Float` to `Int` in a large production database can cause long-running table locks.
- **Mitigation:** Provided a safe migration strategy using temporary columns (`price_int`, `amount_int`) to allow for near-zero downtime deployment of the schema change.
- **Recommendation:** Run `scripts/safe-migration.ts` during a low-traffic window.
