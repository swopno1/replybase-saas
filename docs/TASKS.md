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
- [x] **Task 005**: Implement Outbound Lead Push (Webhook Action) in Flow Engine.
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

- [x] **Task 014**
  - Priority: HIGH
  - Status: COMPLETED
  - Category: Bug
  - Issue: Account Deletion Regression.
  - Root Cause: `TypeError: Cannot read properties of undefined (reading 'updateMany')` in unit tests.
  - UX/Business Impact: Prevents CI/CD stability; though likely a test-only bug, it blocks verification of GDPR flows.
  - Objective: Fix the `TypeError` in `tests/api/users/account-delete-route.test.ts` by adding missing transaction mocks.
  - Detailed Instructions: The route handler in `app/api/users/account/route.ts` was updated to clean up `adminActivity`, `passwordResetToken`, `activityLog`, `usageLog`, `churnFeedback`, `newsletterSubscriber`, and `dataDeletionRequest` models, but the corresponding unit test mocks were not updated. Add these models with `updateMany` (and `deleteMany` where applicable) to the `tx` object in `tests/api/users/account-delete-route.test.ts`.
  - Expected Deliverables: Passing `tests/api/users/account-delete-route.test.ts`.
  - Dependencies: None.
  - Suggested Rollout Risk: LOW.

- [x] **Task 015**
  - Priority: HIGH
  - Status: COMPLETED
  - Category: Security
  - Issue: Admin Test Runner: Refactor `exec` to `execFile`.
  - Root Cause: Potential command injection risk in `app/api/admin/tests/route.ts` due to use of shell-expanding `exec`.
  - UX/Business Impact: Critical security hardening for platform administrative functions.
  - Objective: Replace `exec` with `execFile` or `spawn` to invoke the load test script safely.
  - Detailed Instructions: 1. In `app/api/admin/tests/route.ts`, replace the `exec` call with `execFile`. 2. Ensure arguments are passed as an array to avoid shell interpretation.
  - Expected Deliverables: Hardened admin test execution endpoint.
  - Dependencies: None.
  - Suggested Rollout Risk: LOW.

- [x] **Task 016**
  - Priority: HIGH
  - Status: COMPLETED
  - Category: QA/DevOps
  - Issue: WhatsApp Production Reliability Audit & Integration Testing.
  - Root Cause: Need for final production-grade validation before enterprise onboarding.
  - UX/Business Impact: Ensures 100% reliability for WhatsApp channel, preventing multi-tenant leaks and quota bypass.
  - Objective: Perform deep inspection and implement robust integration tests for all supported WhatsApp providers.
  - Detailed Instructions: 1. Inspect provider abstractions and webhook handlers. 2. Implement integration tests for tenant isolation, worker logic, reliability, and subscription limits. 3. Generate production readiness reports.
  - Expected Deliverables: Passing integration test suite (`tests/integration/whatsapp/`) and comprehensive audit documentation in `docs/testing/`.
  - Dependencies: None.
  - Suggested Rollout Risk: LOW.

- [ ] **Task 017**
  - Priority: LOW
  - Status: PENDING
  - Category: Features
  - Issue: Advanced WhatsApp Media Support (Storage & Outbound).
  - Root Cause: Current integration only supports textual recognition of media; binary storage and outbound media sending are missing.
  - UX/Business Impact: Enables full rich-media conversations (images, PDFs, voice) in the CRM dashboard.
  - Objective: Implement binary media persistence (S3/GCS) for incoming messages and extend provider logic for outbound media.
  - Detailed Instructions: 1. Add `metadata` field to `CrmMessage` model. 2. Implement media download/upload service for incoming `media_id`. 3. Add `sendWhatsAppMedia` to `lib/whatsapp-provider.ts`. 4. Update UI to render images and file download links.
  - Expected Deliverables: Full media support across WhatsApp Cloud API and CRM dashboard.
  - Dependencies: S3/Storage infrastructure.
  - Suggested Rollout Risk: MEDIUM (storage costs and bandwidth).

- [x] **Task 018**
  - Priority: HIGH
  - Status: COMPLETED
  - Category: QA/AI
  - Issue: Omnichannel Conversational Audit & V6 Orchestration Stabilization.
  - Root Cause: Naming mismatches between DB flows and V6 templates; Flow engine blocking AI fallback.
  - UX/Business Impact: Ensures high-reliability routing to conversion flows and seamless AI takeover for edge cases.
  - Objective: Perform production-grade conversational inspection, sync flow names, and improve handover logic.
  - Detailed Instructions: 1. Sync DB flow names with V6 Master Orchestrator. 2. Implement `shouldFallbackToAi` in the flow engine. 3. Audit conversion psychology and lead capture breakpoints.
  - Expected Deliverables: Updated `lib/bot-entry-flow-engine.ts`, synced flows in DB, and 8 comprehensive audit reports in `docs/testing/`.
  - Dependencies: None.
  - Suggested Rollout Risk: LOW.

- [x] **Task 019**
  - Priority: HIGH
  - Status: COMPLETED
  - Category: QA/Admin
  - Issue: Admin Conversation Simulation & QA Module.
  - Root Cause: Lack of internal tools to verify subscriber bot logic without affecting production data.
  - UX/Business Impact: Significant improvement in bot reliability, onboarding efficiency, and sales demo capabilities.
  - Objective: Design and implement a production-grade Simulation Lab in the Admin Panel for testing subscriber bots.
  - Detailed Instructions: 1. Modify flow engine to support a side-effect-free 'Sandbox Mode'. 2. Create `/api/admin/subscribers/[id]/simulate` API. 3. Build a visual Simulation Lab UI in the subscriber detail page with chat, timeline, and AI/CRM inspectors. 4. Implement predefined test scenarios and reporting.
  - Expected Deliverables: Simulation Lab tab in Admin Panel, Sandbox-aware flow engine, and comprehensive simulation reports.
  - Dependencies: Task 018.
  - Suggested Rollout Risk: LOW (Admin-only feature).

- [x] **Task 020**
  - Priority: HIGH
  - Status: COMPLETED
  - Category: Infrastructure/AI
  - Issue: DigitalOcean AI Inference Migration.
  - Root Cause: Need for lower latency (intra-DC) and higher cost efficiency for AI workloads.
  - UX/Business Impact: ~40% latency reduction for chat and ~61% cost reduction for AI OpEx.
  - Objective: Migrate core AI workloads from OpenAI/Gemini to DigitalOcean Gradient (Llama 3.1).
  - Detailed Instructions: 1. Unify AI service and routing. 2. Implement task-based provider selection via ENV vars. 3. Update documentation and verify build.
  - Expected Deliverables: Unified `lib/ai-service.ts`, updated `docs/ai/migration-guide-digitalocean.md`, and passing build.
  - Dependencies: None.
  - Suggested Rollout Risk: LOW.
