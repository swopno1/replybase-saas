# ReplyBase Master Task List - Operational Intelligence Hub

## 1. Core Stability & DevOps

- [ ] **Task 001**
  - Priority: HIGH
  - Status: PENDING
  - Category: Performance/Database
  - Severity: HIGH
  - Issue: Dashboard Metrics Latency.
  - Root Cause: Real-time aggregation of dashboard stats (Lead counts, Conversation volume) are computed on the fly from the DB.
  - Business Impact: Significant improvement in dashboard load times and reduction in DB CPU usage during peak hours.
  - Objective: Implement Redis-based caching for all dashboard metric components.
  - Detailed Instructions: 1. Wrap `app/(dashboard)/page.tsx` data queries in a caching utility. 2. Use `dashboard:stats:[tenantId]` keys with a 5-minute TTL. 3. Implement event-driven cache invalidation.
  - Expected Deliverables: Cached metrics layer and invalidation logic.
  - Dependencies: Redis infrastructure.
  - Notes: Consolidated from Task 003 and 022. Aug 2026 Audit confirmed this is still pending and high priority for dashboard responsiveness.
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

## 2. Product & Feature Expansion

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

## 3. UI/UX & Interaction Polish

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
  - Notes: See docs/proposals_mobile-flow-summary/STRATEGIC_OVERVIEW.md.
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
  - Notes: Consolidated from Task 013. Aug 2026 Audit confirmed StatusCards and Milestones remain static and require this interactivity upgrade.
  - Rollout Risk: LOW.

- [ ] **UX-001**
  - Priority: LOW
  - Status: PENDING
  - Category: Layout
  - Severity: LOW
  - Issue: Generic "No results" empty states.
  - Root Cause: Default table implementation lacks actionable guidance for empty datasets.
  - Business Impact: Users may feel stuck or confused in fresh accounts.
  - Objective: Replace generic "No results" with actionable empty states in all tables.
  - Detailed Instructions: Create a reusable `EmptyState` component with an icon, title, description, and primary CTA button.
  - Expected Deliverables: Reusable component and implementation in Contacts, Conversations, and Bots tables.
  - Dependencies: None.
  - Notes: Standardize across all modules.
  - Rollout Risk: LOW.

- [ ] **UX-002**
  - Priority: LOW
  - Status: PENDING
  - Category: Polish
  - Severity: LOW
  - Issue: Inconsistent icon stroke weights.
  - Root Cause: Ad-hoc icon usage without strict design system enforcement.
  - Business Impact: Degraded premium feel and visual noise.
  - Objective: Standardize icon stroke width (Lucide default) across the platform.
  - Detailed Instructions: Audit all Lucide icon imports and ensure no custom `strokeWidth` overrides exist unless intentionally varied.
  - Expected Deliverables: Consistent visual iconography.
  - Dependencies: None.
  - Notes: Improves platform-wide coherence.
  - Rollout Risk: LOW.

- [ ] **UX-003**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Performance
  - Severity: MEDIUM
  - Issue: Missing skeleton loaders in Detail views.
  - Root Cause: Asynchronous data fetching causes jarring layout shifts.
  - Business Impact: Perceived slowness and poor user experience during loading.
  - Objective: Implement skeleton loading states for Conversation Detail and Settings views.
  - Detailed Instructions: Create skeleton primitives matching the layout of the detail views and show them while `isLoading` is true.
  - Expected Deliverables: Skeleton components for core detail views.
  - Dependencies: None.
  - Notes: High impact on perceived performance.
  - Rollout Risk: LOW.

- [ ] **UX-007**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: Onboarding
  - Severity: MEDIUM
  - Issue: Onboarding: Interstitial Loading State.
  - Root Cause: Direct redirect from plan selection to dashboard feels jarring.
  - Business Impact: Increases perceived professionalism and allows time for workspace provisioning.
  - Objective: Add a "Preparing your workspace" interstitial.
  - Detailed Instructions: Create a new page with a progress bar and helpful tips while backend finalizes setup.
  - Expected Deliverables: Interstitial component and updated navigation logic.
  - Dependencies: None.
  - Notes: Use Framer Motion for smooth transitions.
  - Rollout Risk: LOW.

- [ ] **UX-009**
  - Priority: MEDIUM
  - Status: PENDING
  - Category: CRM
  - Severity: LOW
  - Issue: Feedback: Implementation of "AI Thinking" indicators.
  - Root Cause: Users are unaware when AI fallback is generating a response.
  - Business Impact: Reduces user frustration during AI generation periods.
  - Objective: Show "Bot is drafting response..." indicator in the conversation list.
  - Detailed Instructions: Update the conversation list to check for active background jobs related to a conversation ID.
  - Expected Deliverables: Real-time "Thinking" indicator in the dashboard.
  - Dependencies: WebSocket or polling mechanism.
  - Notes: See Task 018 for engine context.
  - Rollout Risk: LOW.

- [ ] **UX-010**
  - Priority: LOW
  - Status: PENDING
  - Category: Onboarding
  - Severity: LOW
  - Issue: Polish: Success/Celebration states.
  - Root Cause: Completing setup steps feels clinical.
  - Business Impact: Increases user "Setup Momentum" and emotional connection.
  - Objective: Add celebratory micro-interactions when milestones are achieved.
  - Detailed Instructions: Use `canvas-confetti` or Framer Motion effects when a milestone status changes to completed.
  - Expected Deliverables: Celebration effects on Dashboard.
  - Dependencies: None.
  - Notes: See app/(dashboard)/page.tsx for milestone logic.
  - Rollout Risk: LOW.
