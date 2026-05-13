# ReplyBase Project Tasks - Master Backlog

## 1. Security & Data Integrity

- [x] **Task 001**
  - Priority: HIGH
  - Status: COMPLETED
  - Category: Security
  - Severity: HIGH
  - Issue: Missing `tenantId` in `WebhookLog` model.
  - Root Cause: Early implementation prioritized functionality over strict multi-tenant log isolation.
  - Business Impact: Risk of cross-tenant log leakage and degraded query performance.
  - Objective: Add `tenantId` to `WebhookLog` and update all creation calls.
  - Detailed Instructions: 1. Update `schema.prisma`. 2. Update all `prisma.webhookLog.create` calls. 3. Backfill existing data.
  - Expected Deliverables: Scoped webhook logs.
  - Dependencies: None.
  - Notes: Completed in Task 001/010 cycle.
  - Rollout Risk: LOW.

- [x] **Task 002**
  - Priority: MEDIUM
  - Status: COMPLETED
  - Category: Security
  - Severity: MEDIUM
  - Issue: Legacy "check-then-act" patterns in API routes.
  - Root Cause: Standard implementation pattern before adoption of atomic scoped lookups.
  - Business Impact: Potential IDOR vulnerabilities.
  - Objective: Refactor API routes to use atomic scoped lookups (`{ id, tenantId }`).
  - Detailed Instructions: Audit all routes and replace ownership checks followed by actions with single atomic queries.
  - Expected Deliverables: Hardened API handlers.
  - Dependencies: None.
  - Notes: Completed in July 2026.
  - Rollout Risk: LOW.

- [ ] **Task 021**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Security/Observability
  - Severity: MEDIUM
  - Issue: Granular Admin Audit Logging.
  - Root Cause: Admin activity logging currently only tracks mutations, leaving a gap in "Read-access" visibility for sensitive data.
  - Business Impact: Essential for Enterprise-grade security and SOC2/GDPR compliance.
  - Objective: Implement read-access logging for sensitive Admin API routes.
  - Detailed Instructions: 1. Create a `withAdminAudit` wrapper for GET handlers. 2. Log access to PII, conversation logs, and tenant credentials. 3. Ensure logs are stored with a TTL.
  - Expected Deliverables: Logging decorator and updated admin API handlers.
  - Dependencies: None.
  - Notes: High priority for Enterprise tier.
  - Rollout Risk: LOW.

## 2. Infrastructure & Reliability

- [ ] **Task 011**
  - Priority: HIGH
  - Status: PENDING
  - Category: Performance
  - Severity: MEDIUM
  - Issue: Redis Metrics Caching (Implementation).
  - Root Cause: Dashboard stats (Lead counts, Conversation volume) are computed on the fly from the DB.
  - Business Impact: Significant improvement in dashboard load times and reduction in DB CPU usage during peak hours.
  - Objective: Implement Redis-based caching for all dashboard metric components.
  - Detailed Instructions: 1. Wrap `app/(dashboard)/page.tsx` data queries in a caching utility. 2. Use `dashboard:stats:[tenantId]` keys with a 5-minute TTL. 3. Implement event-driven cache invalidation.
  - Expected Deliverables: Cached metrics layer and invalidation logic.
  - Dependencies: Redis infrastructure.
  - Notes: Consolidated from Task 003 and 022.
  - Rollout Risk: MEDIUM.

- [ ] **Task 004**
  - Priority: HIGH
  - Status: PENDING
  - Category: DevOps
  - Severity: CRITICAL
  - Issue: Automated DB & Redis Backups.
  - Root Cause: Lack of automated disaster recovery orchestration.
  - Business Impact: Risk of permanent data loss in case of infrastructure failure.
  - Objective: Set up automated S3/GCS backups for PostgreSQL and Redis persistence.
  - Detailed Instructions: 1. Configure pg_dump cron job. 2. Configure Redis RDB/AOF snapshots. 3. Upload to secure cloud storage.
  - Expected Deliverables: Backup automation scripts and verification.
  - Dependencies: Cloud storage credentials.
  - Notes: Essential for production stability.
  - Rollout Risk: LOW.

## 3. Product & Feature Expansion

- [x] **Task 005**
  - Priority: HIGH
  - Status: COMPLETED
  - Category: Features
  - Severity: HIGH
  - Issue: Outbound Lead Push (Webhook Action) in Flow Engine.
  - Root Cause: Customer request for real-time CRM integration.
  - Business Impact: Enables real-time lead sync with CRMs, increasing product "stickiness".
  - Objective: Implement Webhook Action node in Flow Engine.
  - Detailed Instructions: 1. Add 'trigger_webhook' action. 2. Implement reliable delivery via BullMQ.
  - Expected Deliverables: Webhook dispatcher service and UI for action node.
  - Dependencies: None.
  - Notes: Completed in Lead Connect & Action Engine cycle.
  - Rollout Risk: LOW.

- [ ] **Task 006**
  - Priority: LOW
  - Status: PENDING
  - Category: Features
  - Severity: LOW
  - Issue: Advanced "AI Analytics" dashboard.
  - Root Cause: Lack of high-level insights for Pro/Business tier users.
  - Business Impact: Provides high-value insights for premium users.
  - Objective: Create a dashboard for AI-extracted metrics (intent, sentiment, lead score).
  - Detailed Instructions: 1. Aggregate lead insights. 2. Build visual analytics charts.
  - Expected Deliverables: New Analytics page.
  - Dependencies: Lead enrichment data.
  - Notes: Part of Phase 4 roadmap.
  - Rollout Risk: LOW.

- [ ] **Task 017**
  - Priority: LOW
  - Status: PENDING
  - Category: Features
  - Severity: MEDIUM
  - Issue: Advanced WhatsApp Media Support.
  - Root Cause: Current integration only supports textual recognition of media.
  - Business Impact: Enables full rich-media conversations in the CRM dashboard.
  - Objective: Implement binary media persistence and outbound media support.
  - Detailed Instructions: 1. Add metadata to CrmMessage. 2. Implement media download service. 3. Extend provider logic for outbound media.
  - Expected Deliverables: Full media support across WhatsApp and CRM.
  - Dependencies: S3/Storage infrastructure.
  - Notes: Requires storage scaling plan.
  - Rollout Risk: MEDIUM.

- [x] **Task 020**
  - Priority: HIGH
  - Status: COMPLETED
  - Category: Infrastructure/AI
  - Severity: HIGH
  - Issue: DigitalOcean AI Inference Migration.
  - Root Cause: Need for lower latency and cost efficiency.
  - Business Impact: ~40% latency reduction and ~61% cost reduction.
  - Objective: Migrate AI workloads to DigitalOcean Gradient.
  - Detailed Instructions: 1. Unify AI service. 2. Implement provider selection via ENV.
  - Expected Deliverables: Unified ai-service.ts.
  - Dependencies: None.
  - Notes: Migration completed August 2026.
  - Rollout Risk: LOW.


## 4. UI/UX Polish

- [ ] **Task 012**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: UX
  - Severity: MEDIUM
  - Issue: Mobile Flow Editor Friction.
  - Root Cause: Complex visual editor is difficult on small screens.
  - Business Impact: Prevents mobile bot adjustments.
  - Objective: Implement a read-only "Flow Summary" list view for mobile.
  - Detailed Instructions: 1. Detect mobile agent. 2. Replace visual editor with list of nodes.
  - Expected Deliverables: Mobile-optimized flow summary component.
  - Dependencies: None.
  - Notes: See docs/proposals_mobile-read-only-flow/overview.md.
  - Rollout Risk: LOW.

- [ ] **Task UX-008**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Dashboard
  - Severity: MEDIUM
  - Issue: Interaction: Interactive Dashboard Funnel.
  - Root Cause: Dashboard cards and milestones are currently static.
  - Business Impact: Improves navigation and guides users to next setup action.
  - Objective: Make dashboard cards clickable to navigate to relevant settings.
  - Detailed Instructions: 1. Update status-cards.tsx with Links. 2. Wrap Milestone items in Links.
  - Expected Deliverables: Interactive dashboard layout.
  - Dependencies: None.
  - Notes: Consolidated from Task 013.
  - Rollout Risk: LOW.

- [x] **Task 014**
  - Priority: HIGH
  - Status: COMPLETED
  - Category: Bug
  - Severity: MEDIUM
  - Issue: Account Deletion Regression.
  - Root Cause: Missing transaction mocks in unit tests.
  - Business Impact: Blocks CI/CD stability for GDPR flows.
  - Objective: Fix TypeError in account-delete-route.test.ts.
  - Detailed Instructions: Add missing model mocks to the tx object in tests.
  - Expected Deliverables: Passing account deletion tests.
  - Dependencies: None.
  - Notes: Completed August 2026.
  - Rollout Risk: LOW.
