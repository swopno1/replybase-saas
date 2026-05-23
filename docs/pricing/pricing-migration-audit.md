# Pricing Migration Audit — August 2026

## Executive Summary
This audit details the transition from the legacy three-tier subscription model to the new four-tier pricing architecture. The migration addresses critical gaps in the platform's pricing strategy, normalizes the underlying billing data structures, and ensures zero-downtime backward compatibility for active production users.

---

## 1. Legacy Pricing Critique & Rationales
The original pricing model jumped directly from **Starter (£29/month)** to **Pro (£89/month)**, representing an abrupt **206% increase**. 
- **Customer Friction**: Customers exceeding the Starter limits had to make a massive price leap, leading to high churn rates at the transition point.
- **Lost Revenue**: Solo-founders and growing SMBs were unable to find a plan matching their medium-scale volumes.
- **The Solution**: We introduce the **Grow (£49/month)** plan, smoothing out the pricing curve:
  $$\text{Launch (£29)} \longrightarrow \text{Grow (£49)} \longrightarrow \text{Scale (£89)} \longrightarrow \text{Business (£249)}$$

---

## 2. Plan Limits & Gating Mapping
The limits have been restructured to map resources to the appropriate pricing:

| Dimension / Resource | Free | Launch | Grow (New) | Scale | Business |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Monthly Price (GBP)** | £0 | £29 | £49 | £89 | £249 |
| **Annual Price (GBP)** | £0 | £290 | £490 | £890 | £2,490 |
| **Monthly AI Responses** | 100 | 1,000 | 3,500 | 7,500 | 25,000 |
| **Flow Automations Cap** | 200 | 1,500 | 5,000 | 10,000 | 40,000 |
| **Active Bots Count** | 1 | 2 | 5 | 10 | 25 |
| **Active Channels** | 1 (Webchat) | 2 (Webchat + FB/WA) | 3 (Webchat + FB + WA) | 5 (Webchat + FB + WA + TG) | All channels |
| **API Access** | No | No | No | Yes | Yes |
| **CRM Integration** | No | Yes | Yes | Yes | Yes |

---

## 3. Database Model & Schema Analysis
In ReplyBase, plans are not hardcoded static models; they are dynamic records in the `plans` table governed by the Prisma schema:

```prisma
model Plan {
  id                  String         @id @default(cuid())
  name                String         @unique // launch, grow, scale, business
  displayName         String
  price               Int            @default(0) // monthly price in GBP
  dailyMessageLimit   Int            @default(100)
  monthlyMessageLimit Int            @default(1000)
  flowExecutionCap    Int            @default(1500)
  maxBots             Int            @default(2)
  maxChannelsPerBot   Int            @default(2)
  maxConversations    Int            @default(1500)
  features            Json           @default("{}")
  subscriptions       Subscription[]
  @@map("plans")
}
```

### Plan Normalization & Aliasing
Existing client subscriptions refer to legacy name columns in the database. To prevent database migration breakage, the database name fields remain strings. We resolve them using normalized keys in the backend logic:
- `starter` maps to the new `launch` limits.
- `pro` maps to the new `scale` limits.
- `grow` and `business` map directly.

---

## 4. Risk Assessment & Zero-Downtime Migration
To guarantee zero-downtime, the pricing migration implements defensive coding strategies:

1. **Environment Variables**:
   We support alias fallbacks for Price IDs. If `NEXT_PUBLIC_STRIPE_LAUNCH_PRICE_ID` is missing in hosting, it automatically falls back to `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID`.
2. **Webhook Ingestion**:
   Stripe webhook processing (`syncSubscription` in `lib/billing-service.ts`) matches names case-insensitively and maps both legacy and new values:
   - "starter" or "launch" $\rightarrow$ `launch` plan record.
   - "pro" or "scale" $\rightarrow$ `scale` plan record.
3. **Database Seeding**:
   The seeding script (`scripts/seed-stripe.ts`) uses Prisma `upsert` matching the plan name key to ensure no records are duplicated, and existing limit columns are updated safely.
