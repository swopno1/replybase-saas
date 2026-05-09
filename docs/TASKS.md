# ReplyBase Project Tasks

## 1. Security & Data Integrity
- [ ] **Task 001**: Add `tenantId` to `WebhookLog` model. Update all `prisma.webhookLog.create` calls to include the tenant context.
  - Priority: HIGH
  - Category: Security
  - Impact: Prevents potential cross-tenant log leakage and improves query performance.
- [ ] **Task 002**: Refactor legacy "check-then-act" API routes to use atomic scoped lookups (`{ id, tenantId }`).
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
