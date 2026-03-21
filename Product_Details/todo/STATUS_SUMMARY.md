# ReplyBase Product Roadmap Status Summary

**Last Updated:** 20 March 2026  
**Build Status:** ✅ All passing (87 routes, 0 TS errors)

---

## Executive Summary

All major product roadmap items are either **done** or **in-progress**. Core runtime consistency (P0/P1) is stable; Phase 3 analytics expansion (P2) is actively being developed with segmented KPI dashboard complete. TikTok entry gates are 85%+ ready; final P0/P1 refinements underway.

| Item                            | Status         | Progress         | Owner                       |
| ------------------------------- | -------------- | ---------------- | --------------------------- |
| **P0: Product Clarity**         | ✅ Done        | 100%             | Product + Engineering       |
| **P1: Channel Parity**          | ✅ Done        | 100%             | Engineering                 |
| **P0: Production Deployment**   | 🔄 In-progress | 60%              | Engineering + DevOps        |
| **P1: Diagnostics Unification** | 🔄 In-progress | 70%              | Engineering + Design        |
| **P2: Growth Enablement**       | 🔄 In-progress | 85%              | Product Marketing + Product |
| **P2: TikTok Next-Stage**       | ⏳ Planned     | 0% (gates ready) | Product + Engineering       |

---

## Detailed Status by Initiative

### ✅ P0: Product Clarity and Runtime Model

**Status:** DONE (100%)

**Completed:**

- Canonical terminology applied consistently (Bot, Channel, Flow, AI Engine)
- Effective Response Mode documented on all channel integration pages
- Runtime decision tree published and aligned across teams
- Conflicting "Builder" runtime labels removed

**Artifacts:**

- Product_Details strategy documents
- Integration pages (Facebook, Telegram, Webchat)
- Operational guidance and runtime documentation

---

### ✅ P1: Channel Parity and Flow Assignment

**Status:** DONE (100%)

**Completed:**

- Channel-agnostic flow assignment model implemented (`FlowChannelAssignment`)
- Telegram and Webchat entry flow runtime engines built
- Global template support with admin controls
- Admin user management UI (`/admin/users`)
- Migration script for legacy Facebook assignments

**Artifacts:**

- `lib/bot-entry-flow-engine.ts`
- `app/(dashboard)/flows/[id]/settings` (channel assignment controls)
- `app/api/flows/[id]/assign` (channel-agnostic API)
- `scripts/backfill-facebook-flow-assignments.ts`

**Codebase Evidence:**

- ✅ `FlowChannelAssignment` Prisma model and migrations
- ✅ Telegram/Webchat runtime uses assignment model with fallback to legacy `entryFlow`
- ✅ Facebook dashboard supports cross-tenant global templates
- ✅ `isAdmin` field propagated through JWT and session

---

### 🔄 P0: Production Deployment Excellence

**Status:** IN-PROGRESS (60%)

**Completed:**

- ✅ Deployment checklist documented (`documentation/deployment-checklist.md`)
- ✅ Pre-release mandatory checks defined
- ✅ KPI health monitoring system built (`/admin/kpi-health`)
- ✅ Webhook logging infrastructure (`/admin/webhook-logs`)
- ✅ Health checks monitor data freshness, webhook connectivity, milestone pipeline
- ✅ Migration safety guidance documented

**In-Progress / Pending:**

- ⚠️ Release gate enforcement (currently manual checklist)
- ⚠️ Automated 429/5xx spike alerting
- ⚠️ On-call escalation automation
- ⚠️ Channel verification matrix integration test dashboard
- ⚠️ Incident review tracking system

**Artifacts:**

- `lib/kpi-health-check.ts` (checks data freshness, webhook health, etc.)
- `app/(dashboard)/admin/kpi-health/page.tsx` (dashboard)
- `app/(dashboard)/admin/webhook-logs/page.tsx` (log viewer)
- `documentation/deployment-checklist.md`
- `KPI_MONITORING_RUNBOOK.md`

**Next Steps:**

1. Build automated release gate enforcement in CI/CD pipeline
2. Set up threshold-based alerting for error spikes
3. Integrate incident tracking with runbook automation
4. Create channel verification matrix test dashboard

---

### 🔄 P1: Status and Diagnostics Unification

**Status:** IN-PROGRESS (70%)

**Completed:**

- ✅ Status model defined (active, paused, disabled, error)
- ✅ AI status UX refactored (system health separate from channel behavior)
- ✅ Telegram integration page has diagnostic summary
- ✅ Webchat integration page has diagnostic summary
- ✅ Runtime logic uses unified status states

**In-Progress / Pending:**

- ⚠️ Extract reusable `DiagnosticSummary` component for all channels
- ⚠️ Add diagnostic hints/troubleshooting guidance to integration pages
- ⚠️ Facebook integration needs diagnostic summary block
- ⚠️ Centralized operator handbook with common misconfiguration causes

**Artifacts:**

- `app/(dashboard)/integrations/telegram/page.tsx` (has diagnostics)
- `app/(dashboard)/integrations/webchat/page.tsx` (has diagnostics)
- `app/(dashboard)/ai-status/page.tsx` (system health)

**Next Steps:**

1. Extract diagnostic block component from Telegram/Webchat pages
2. Add to Facebook integration page
3. Create operator handbook documenting common issues and remediation
4. Add in-page hints for misconfigurations

---

### 🔄 P2: Growth Enablement and Packaging

**Status:** IN-PROGRESS (85%)

#### **Phase A: Packaging & Messaging** ✅ DONE

- Updated pricing/in-app copy to align with runtime behavior
- Removed unsupported channel claims (WhatsApp, Email)
- Finalized capability table by channel

#### **Phase B: Activation Onboarding** ✅ DONE

- Dashboard milestone cards (first connected channel, first reply)
- `OnboardingMilestoneEvent` model and analytics layer
- Milestone capture integrated across all webhook handlers
- Analytics API: `GET /api/analytics/onboarding-milestones`

#### **Phase C: Vertical Templates** ✅ DONE

- 3 vertical templates created (services, agencies, booking)
- Template API: `POST /api/flows/from-template`
- Clone API: `POST /api/flows/[flowId]/clone`
- UI: Template selection dialog with guidance

#### **Phase D: KPI Dashboard** 🔄 IN-PROGRESS (ongoing)

**Phase D.1 - Basic Dashboard** ✅ DONE

- Admin analytics page: `/admin/analytics`
- KPIs: activation speed, weekly active tenants, webhook setup rate
- Metrics: time to first connected channel, time to first reply

**Phase D.2 - Segmented Analytics** ✅ DONE (Phase 3)

- Segmented KPI library: `lib/segmented-activation-kpis.ts`
- Segmented analytics page: `/admin/segmented-analytics`
- Tenant filtering by plan, channel, cohort
- Activation funnel visualization (3 stages: signup → first-channel → first-reply)
- Webchat acquisition attribution analysis (sources, mediums, campaigns, referrers, landing pages)
- Weekly trend chart (acquisition attribution rate by week)
- Full component suite compiled and validated

**Phase D.3 - Planned Extensions** (Phase 3 future)

- Campaign-over-time comparison (top 3 campaigns as series)
- Landing-page → activation correlation analysis
- Cohort retention tracking over time

**Artifacts:**

- `lib/segmented-activation-kpis.ts`
- `app/api/admin/segmented-kpis/route.ts`
- `app/(dashboard)/admin/segmented-analytics/page.tsx`
- `components/admin/activation-funnel-analysis.tsx`
- `components/admin/webchat-acquisition-analysis.tsx`
- `components/admin/segmented-analytics-dashboard.tsx`

**Build Status:**

- ✅ All 87 routes compiling successfully
- ✅ TypeScript strict mode passing
- ✅ No Turbopack errors
- ✅ Next.js 16 params pattern enforced across all dynamic handlers

---

### ⏳ P2: TikTok Next-Stage Plan

**Status:** PLANNED (Entry Gates ~85% Ready)

**Entry Gates Assessment:**

- ✅ Gate 1: Runtime parity (P1 complete)
- ⚠️ Gate 2: Diagnostics UX (P1 in-progress; ~70% done)
- ⚠️ Gate 3: Deployment excellence (P0 in-progress; ~60% done)

**Readiness:** Can begin TikTok discovery phase after P1 diagnostics and P0 deployment refinements complete (~2-3 weeks)

**Pre-Requisites for Unblocking:**

1. Extract reusable `DiagnosticSummary` component and apply to all channels
2. Publish operator handbook
3. Implement automated release gate enforcement in CI/CD

**Next Phase (After Gates Ready):**

1. TikTok API discovery and compliance mapping
2. Architecture and data model design
3. Build and internal validation
4. Private beta rollout

---

## Build & Code Quality

**Latest Build Status:** ✅ PASSING

```
npm run build
→ Compiled successfully (20.2s)
→ 87/87 static pages generated
→ 0 TypeScript errors
→ 0 Turbopack compilation errors
```

**Recent Fixes (Phase 3 Increment):**

1. ✅ `flows/page.tsx` syntax corruption (handleCreateFromTemplate extraction)
2. ✅ `flows/page.tsx` dialog JSX nesting (three sibling dialogs restored)
3. ✅ `clone/route.ts` Next.js 16 params type (`Promise<{...}>`)
4. ✅ `kpi-health-check.ts` type mismatch (`freshness` → `dataFreshness`)

**Code Organization:**

- ✅ Admin analytics surface fully typed and validated
- ✅ Segmented analytics library complete with all required types
- ✅ API routes follow Next.js 16 conventions consistently
- ✅ Component hierarchy organized and reusable

---

## Immediate Next Actions

### This Week

1. **P2 Phase D.3:** Implement campaign-over-time comparison in segmented analytics
2. **P1 Diagnostics:** Extract reusable `DiagnosticSummary` component
3. **P0 Deployment:** Add automated release gate checks to CI pipeline

### Next Sprint

1. **P1 Diagnostics:** Publish operator handbook
2. **P0 Deployment:** Implement threshold-based alerting for error spikes
3. **P1 Diagnostics:** Add diagnostic hints/guidance to all integration pages

### Unblock TikTok Entry

1. Complete P1 diagnostics unification (extract component, handbook)
2. Complete P0 deployment excellence (automated gates, alerting)
3. Begin TikTok discovery phase

---

## Dependency Graph

```
P0_Product_Clarity         (DONE)
    ↓
P1_Channel_Parity         (DONE)
P1_Diagnostics            (IN-PROGRESS) ←— depends on P0
    ↓
P0_Production_Deployment  (IN-PROGRESS)
    ↓
P2_Growth_Enablement      (IN-PROGRESS) ←— depends on P0/P1
    ↓
P2_TikTok_Next_Stage      (PLANNED) ←— blocked on P0/P1/P2 completion
```

---

## Key Metrics

| Metric                       | Current      | Target       |
| ---------------------------- | ------------ | ------------ |
| Build success rate           | 100%         | 100%         |
| Type check pass rate         | 100%         | 100%         |
| Admin pages compiled         | 16/16        | 16/16        |
| Segmented analytics features | 3/4          | 4/4          |
| Diagnostic surface coverage  | 2/3 channels | 3/3 channels |
| Deployment automation        | 30%          | 90%          |

---

## Document Locations

**Roadmap & Status:**

- `Product_Details/todo/P0_Product_Clarity_and_Runtime_Model.md`
- `Product_Details/todo/P0_Production_Deployment_Excellence.md`
- `Product_Details/todo/P1_Channel_Parity_and_Flow_Assignment.md`
- `Product_Details/todo/P1_Status_And_Diagnostics_Unification.md`
- `Product_Details/todo/P2_Growth_Enablement_and_Packaging.md`
- `Product_Details/todo/P2_TikTok_Next_Stage_Plan.md`
- `Product_Details/todo/STATUS_SUMMARY.md` (this file)

**Implementation Guides:**

- `documentation/deployment-checklist.md`
- `documentation/deployment-plan.md`
- `KPI_MONITORING_RUNBOOK.md`

**Code & Architecture:**

- `lib/segmented-activation-kpis.ts` (Phase 3 KPI library)
- `lib/kpi-health-check.ts` (Health monitoring)
- `lib/bot-entry-flow-engine.ts` (Runtime routing)

---

## Questions & Contact

For questions on roadmap status, feature implementation details, or deployment plans:

1. Check this summary document (STATUS_SUMMARY.md)
2. Review the specific initiative MD file (P0*\*, P1*_, P2\__)
3. Refer to implementation guides in `documentation/`
4. Review code artifacts referenced above
