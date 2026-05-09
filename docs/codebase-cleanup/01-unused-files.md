# Codebase Audit: Unused Files

This report identifies files that appear to have no incoming imports or references within the primary application directories (`/app`, `/components`, `/lib`).

## 1. Scratch & Scripts (SAFE TO DELETE / ARCHIVE)
These are utility scripts or experimental files that should not be in the production source tree.

### /scratch
- `scratch/check_db.js`
- `scratch/check_plans.ts`
- `scratch/check-plans.js`
- `scratch/test-prisma.ts`
- `scratch/check_plans.js`
- `scratch/check-plans.ts`

### /scripts (Likely for one-time use or local dev)
- `scripts/test-telegram.ts`
- `scripts/migrate-to-cents.ts`
- `scripts/test-webhook.sh`
- `scripts/safe-migration.ts`
- `scripts/check-webhook-logs.ts`
- `scripts/delete-user-flows.ts`
- `scripts/test-api-integration.sh`
- `scripts/seed-stripe.ts`
- `scripts/fix-bot-relations.ts`
- `scripts/test-stripe-webhook.ts`
- `scripts/test-db.ts`
- `scripts/sync-plans.js`
- `scripts/test-facebook-message.sh`
- `scripts/verify-subflow-links.ts`
- `scripts/add-user-flow.ts`

## 2. Components (SAFE TO DELETE)
These components are not imported by any other file in the codebase.

- `components/nav-secondary.tsx`
- `components/create-bot-form.tsx`
- `components/nav-main.tsx`
- `components/section-cards.tsx`
- `components/LandingFooter.tsx`
- `components/nav-documents.tsx`
- `components/ai-toggle.tsx`
- `components/admin-nav.tsx`
- `components/edit-subscriber-dialog.tsx`
- `components/trial-badge.tsx`
- `components/LandingNavbar.tsx`
- `components/chart-area-interactive.tsx`

## 3. UI Components (ShadCN leftovers - SAFE TO DELETE)
Standard UI components that were likely added but never used in the actual layouts.

- `components/ui/breadcrumb.tsx`
- `components/ui/drawer.tsx`

## 4. Library & Utility Functions (SAFE TO DELETE)
- `lib/telegram-webhook-setup-log.ts` - Replaced by generic `webhook-setup-log.ts`
- `lib/subscription-middleware.ts` - Redundant with `subscription.ts` logic
- `lib/flow-execution-engine.ts` - Legacy Facebook-only flow engine, replaced by `bot-entry-flow-engine.ts`

## 5. Metadata (NEEDS REVIEW)
- `app/manifest.ts` (Standard Next.js file, but maybe not configured/needed yet)
