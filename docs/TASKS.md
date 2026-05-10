# ReplyBase Project Tasks

## 1. Security & Data Integrity
- [x] **Task 001**: Add `tenantId` to `WebhookLog` model. Update all `prisma.webhookLog.create` calls to include the tenant context.
  - Priority: HIGH
  - Category: Security
  - Impact: Prevents potential cross-tenant log leakage and improves query performance.
- [x] **Task 002**: Refactor legacy "check-then-act" API routes to use atomic scoped lookups (`{ id, tenantId }`).
  - Priority: MEDIUM
  - Category: Security
  - Impact: Hardens platform against IDOR vulnerabilities.

## 2. Infrastructure & Reliability
- [ ] **Task 003**: Implement Redis-based caching for high-frequency dashboard metrics (Lead counts, Conversation status).
  - Priority: MEDIUM
  - Category: Performance
  - Impact: Reduces DB load and improves dashboard snappiness.
- [ ] **Task 004**: Set up automated S3/GCS backups for PostgreSQL and Redis persistence.
  - Priority: HIGH
  - Category: DevOps
  - Impact: Critical for production data safety and disaster recovery.

## 3. Product & Feature Expansion
- [ ] **Task 005**: Implement Outbound Lead Push (Webhook Action) in Flow Engine.
  - Priority: HIGH
  - Category: Features
  - Impact: Enables real-time lead sync with CRMs, significantly increasing product "stickiness".
- [ ] **Task 006**: Create advanced "AI Analytics" dashboard.
  - Priority: LOW
  - Category: Features
  - Impact: Provides high-value insights for Pro/Business tier users.

## 4. UI/UX Polish
- [ ] **Task 007**: Implement skeleton loaders for Conversation Detail and Settings views.
  - Priority: MEDIUM
  - Category: UX
  - Impact: Improves perceived performance during data loading.
- [ ] **Task 008**: Add "Success/Celebration" motion effects for onboarding milestone completion.
  - Priority: LOW
  - Category: UX/Delight
  - Impact: Increases user engagement and positive reinforcement during setup.

- [x] **Task 009**
  - Priority: HIGH
  - Status: COMPLETED
  - Category: Security
  - Issue: Scoped Mutation Hardening. Some DELETE routes (e.g. Facebook Page unlink) use global prisma client.
  - Root Cause: Legacy "check-then-act" pattern where deletion is performed using only ID after an initial ownership check.
  - UX/Business Impact: Risk of IDOR if the initial check is bypassed or fails. Essential for Enterprise trust.
  - Objective: Refactor all DELETE/UPDATE routes in `app/api/bots/[botId]/channels/` to use the scoped `db` client from `withAuthAndTenant`.
  - Detailed Instructions: Locate all mutations in integration routes. Ensure they use the `db` instance provided by the `withAuthAndTenant` wrapper, which automatically injects `tenantId` into the `where` clause.
  - Expected Deliverables: Scoped API handlers for Facebook, Telegram, and WhatsApp channel management.
  - Dependencies: None.
  - Notes: This is a preventative security measure.
  - Suggested Rollout Risk: LOW.

- [x] **Task 010**
  - Priority: HIGH
  - Status: COMPLETED
  - Category: Security/Performance
  - Issue: DB Migration: Add `tenantId` to `WebhookLog`.
  - Root Cause: Model was originally designed for global logging and missed the multi-tenant isolation requirement.
  - UX/Business Impact: Prevents potential cross-tenant data exposure and enables per-tenant log dashboards.
  - Objective: Update schema, create migration, and update `logger.ts` and webhook handlers to include `tenantId`.
  - Detailed Instructions: 1. Add `tenantId String` and `tenant Tenant @relation(...)` to `WebhookLog` in `schema.prisma`. 2. Generate migration. 3. Update `lib/logger.ts` or direct `prisma.webhookLog.create` calls to pass the context.
  - Expected Deliverables: Updated Prisma schema, migration file, and updated webhook route handlers.
  - Dependencies: Task 009 (should be done in parallel).
  - Notes: Backfill strategy needed for existing logs.
  - Suggested Rollout Risk: MEDIUM (due to data migration).

- [ ] **Task 011**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Performance
  - Issue: Performance: Dashboard Metric Caching.
  - Root Cause: Dashboard metrics are computed synchronously on every request.
  - UX/Business Impact: Improves dashboard load time and reduces database CPU usage.
  - Objective: Implement Redis-based caching for high-frequency dashboard stats to reduce database I/O.
  - Detailed Instructions: Wrap dashboard statistic queries in a caching layer that checks Redis first. Set TTL to 300 seconds.
  - Expected Deliverables: Cached dashboard service implementation.
  - Dependencies: Redis infrastructure.
  - Notes: Ensure cache invalidation on new lead/message events.
  - Suggested Rollout Risk: LOW.

- [ ] **Task 012**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: UX
  - Issue: Mobile Flow Editor Friction.
  - Root Cause: Complex tree-based visual editor is difficult to use on small screens.
  - UX/Business Impact: Prevents users from making quick bot adjustments on the go.
  - Objective: Implement a read-only "Flow Summary" list view for mobile devices.
  - Detailed Instructions: 1. Detect mobile user agent or viewport. 2. Replace visual editor with a vertical list of nodes. 3. Allow text-only editing of message content.
  - Expected Deliverables: Mobile-optimized flow summary component.
  - Dependencies: None.
  - Notes: See `docs/proposals_mobile-read-only-flow/overview.md`.
  - Suggested Rollout Risk: LOW.

- [ ] **Task 013**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: UX/Engagement
  - Issue: Static Dashboard Funnel.
  - Root Cause: Funnel stages and activation milestones are non-interactive.
  - UX/Business Impact: Low interaction density; misses opportunity for quick navigation.
  - Objective: Make all dashboard funnel stages and milestones clickable.
  - Detailed Instructions: 1. Add `onClick` handlers to funnel stage cards. 2. Implement filtering logic to show leads/conversations corresponding to the clicked stage. 3. Ensure milestones link to their respective setup pages.
  - Expected Deliverables: Interactive dashboard metrics and funnel.
  - Dependencies: None.
  - Suggested Rollout Risk: LOW.

- [ ] **Task 014**
  - Priority: HIGH
  - Status: PENDING
  - Category: Bug
  - Issue: Account Deletion Regression.
  - Root Cause: `TypeError: Cannot read properties of undefined (reading 'updateMany')` in `app/api/users/account/route.ts`.
  - UX/Business Impact: Users cannot delete their accounts, potentially violating GDPR compliance.
  - Objective: Fix the `TypeError` in the account deletion handler.
  - Detailed Instructions: Debug `app/api/users/account/route.ts` around line 37. Ensure all Prisma models are correctly accessed and the user/tenant context is valid.
  - Expected Deliverables: Passing `tests/api/users/account-delete-route.test.ts`.
  - Dependencies: None.
  - Suggested Rollout Risk: LOW.
