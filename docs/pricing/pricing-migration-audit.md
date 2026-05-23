# Pricing Migration Audit - August 2026

## Overview
This audit details the transition from the legacy (Starter, Pro, Business) pricing model to the new tiered architecture (Launch, Grow, Scale, Business) with integrated annual billing and founding offers.

## Current State Analysis
- **Legacy Plans**: Starter, Pro, Business.
- **Identified References**:
  - `lib/plans.ts`: Contains aliases for `starter` -> `launch` and `pro` -> `scale`.
  - `lib/env.ts`: Contains both old and new Price ID environment variables.
  - `app/(dashboard)/pricing/page.tsx`: Partially updated with new plan names but lacks annual billing logic.
  - `public/embed/replybase-webchat.js`: Hardcoded "pro" fallback.
- **Gaps**:
  - No enforcement for specific channel types per plan (e.g., Launch restricting to Webchat + FB/WA).
  - Annual billing toggle missing in UI.
  - Founding offer (FOUNDING50) not explicitly promoted or restricted to annual plans in the checkout flow.

## New Plan Specifications
| Plan | Price (Mo) | Price (Yr) | AI Resp | Automations | Bots | Channels |
|------|------------|------------|---------|-------------|------|----------|
| Free | £0 | £0 | 100 | 200 | 1 | Webchat |
| Launch | £29 | £290 | 1,000 | 1,500 | 2 | Webchat + (FB or WA) |
| Grow | £49 | £490 | 3,500 | 5,000 | 5 | Webchat + FB + WA |
| Scale | £89 | £890 | 7,500 | 10,000 | 10 | Webchat + FB + WA + TG |
| Business| £249 | £2490 | 25,000 | 40,000 | 25 | All |

## Risk Assessment
- **Backward Compatibility**: High. Handled via plan name aliasing in `getPlanConfig`.
- **Billing Continuity**: Medium. Existing subscriptions remain on old price IDs unless migrated.
- **Quota Leakage**: Low. Enforcement is centralized in `lib/subscription.ts`.
