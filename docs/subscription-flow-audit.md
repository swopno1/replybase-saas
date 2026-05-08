# Subscription & Billing Flow Audit: ReplyBase SaaS

## 1. Stripe Integration Lifecycle
### Status: **READY**
- **Checkout**: `app/api/billing/checkout/route.ts` correctly handles customer creation/lookup and trial eligibility.
- **Webhook Handling**: `app/api/billing/webhook/route.ts` handles critical events:
    - `customer.subscription.updated/deleted` -> Syncs local DB state.
    - `invoice.payment_succeeded` -> Records revenue (Cents-safe logic).
    - `invoice.payment_failed` -> Marks status as `PAST_DUE`.
    - `charge.refunded` -> Cancels subscription immediately.

---

## 2. Plan Limits & Enforcement
### Status: **STRONG**
- **Dual-Layer Caching**: L1 (In-memory, 5m) and L2 (Redis, 1h) caches for tenant limits (`lib/subscription.ts`) ensure high performance under load.
- **Granular Enforcement**:
    - **Bot Limit**: `checkBotLimit` enforced during creation.
    - **Channel Limit**: `checkChannelLimit` enforced per-bot.
    - **Usage Zones**: `SAFE`, `WARNING`, `GRACE`, `HARD` pattern allows for user-friendly notifications before hard blocks.

### Identified Risks:
- **[Medium] Downgrade Edge Cases**: If a user downgrades from Pro (5 bots) to Starter (1 bot) while having 3 bots active, the system does not currently "freeze" the extra bots automatically. *Recommendation*: Implement a "suspended" state for bots exceeding new plan limits.
- **[Low] Cache Desync**: L1 cache is per-instance. In a multi-replica deployment, one instance might lag for up to 5 minutes after a subscription change. *Mitigation*: Redis (L2) invalidation is implemented and serves as the source of truth for L1 refreshes.

---

## 3. Financial Integrity
### Status: **PASS**
- **Currency**: Handled in GBP/PENCE to avoid floating-point errors.
- **Revenue Tracking**: `Revenue` model implemented with unique constraint on `stripeInvoiceId` to prevent double-counting.
- **Trial Abuse**: `trialUsed` flag on the `Tenant` model prevents users from repeatedly starting 14-day trials.

---

## 4. Operational Checklist for Launch
- [ ] Verify all Stripe Product/Price IDs in production `.env`.
- [ ] Set up Stripe Webhook signing secret.
- [ ] Confirm `NEXT_PUBLIC_APP_URL` matches the live domain for checkout redirects.
- [ ] Run `pnpm run seed:stripe` in production to populate `Plan` table.
