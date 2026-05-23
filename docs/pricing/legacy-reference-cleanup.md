# Legacy Reference Cleanup

This document indexes all legacy references, variables, and models that were cleaned or mapped to ensure pricing model consistency across the ReplyBase codebases.

---

## 1. Migrated Code References
The following files were updated to map legacy names:

| File Name | Legacy Token | Migrated / Aliased To |
| :--- | :--- | :--- |
| `lib/plans.ts` | `starter` / `pro` | `launch` / `scale` (Internal mapping keeps backward compatibility for DB lookups) |
| `lib/stripe.ts` | `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID` | `NEXT_PUBLIC_STRIPE_LAUNCH_PRICE_ID` (with fallback) |
| `lib/stripe.ts` | `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` | `NEXT_PUBLIC_STRIPE_SCALE_PRICE_ID` (with fallback) |
| `app/api/billing/checkout/route.ts` | `promoCode` manual apply | Dynamic Stripe active promo code lookup |
| `app/api/bots/[botId]/channels/...` | Count-only limit checks | Scoped `checkChannelLimitWithType` type validation |
| `terms/page.tsx` (frontend) | `Starter (£29/mo)` / `Pro` | `Launch` / `Grow` / `Scale` / `Business` limits |

---

## 2. Safe Internal References (Remaining)
The following occurrences of `starter` or `pro` are considered safe to keep:
1. **Prisma Initial Migration (`prisma/migrations/.../migration.sql`)**:
   - The Postgres enum type contains `Plan` values `'STARTER'` and `'PRO'`. Modifying historical migration SQL files is risky and will cause migration checksum failures during CI/CD. The database mapping is instead resolved cleanly inside `lib/plans.ts` and `lib/billing-service.ts`.
2. **"Starter Templates" (`lib/flow-templates.ts` and `segmented-activation-kpis.ts`)**:
   - The word `starter` here refers to starting flow templates for bots (e.g. GYM templates, Lead Capture flow templates) rather than the subscription tier.
3. **"PROMOTED" User Audits (`tests/admin/audit-logging.test.ts`)**:
   - Refers to promoting users to administrative access levels, completely unrelated to subscription billing plans.
