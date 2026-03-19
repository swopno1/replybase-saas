# P2: Growth Enablement and Packaging

Status: in-progress
Owner: Product Marketing + Product
Target window: ongoing

## Goal

Improve activation, retention, and expansion after runtime consistency is in place.

## Tasks

1. Align pricing/package language with actual runtime capabilities.

2. Add onboarding guidance for first successful channel connection and first automated reply.

3. Create vertical templates (services, agencies, booking-heavy businesses).

4. Define KPI dashboard for:

- time to first connected channel
- time to first automated reply
- weekly active tenants with active runtime mode
- failed webhook setup rate

## Implementation Progress

- done: Entered P2 execution phase after P0 and P1 completion checkpoints were validated.
- done: Converted P2 into an actionable work plan with phased deliverables and measurable outputs.
- done: Task 1 (phase-1 delivery) - updated in-app and marketing pricing copy to align with shipped runtime behavior and channel support (Facebook, Telegram, Webchat).
- done: Removed unsupported channel claims from high-visibility marketing copy (e.g., WhatsApp/Email as active integrations) and replaced with current parity channels.
- done: Task 2 (phase-1 delivery) - added dashboard activation milestone card for first connected channel and first automated reply, with direct action CTAs.
- done: Task 2 (phase-2 delivery) - implemented milestone event instrumentation contract (OnboardingMilestoneEvent model) and analytics persistence layer.
  - Added Prisma schema model with tenantId + milestoneId unique constraint for idempotent event recording.
  - Migrated database schema and regenerated Prisma client.
  - Integrated milestone event capture into Facebook, Telegram, and Webchat webhook handlers.
  - Created analytics API endpoint (`GET /api/analytics/onboarding-milestones`) with completion rate, trends, and time-to-completion statistics.
  - Added helper functions for milestone recording, completion checks, and stats retrieval.
- planned: Task 3 implementation - vertical template packs and clone-ready starter flows.
- planned: Task 4 implementation - activation KPI dashboard and reporting views.

## Phase Plan

### Phase A: Packaging and Messaging Alignment (Week 1)

Scope:

- Inventory current pricing page and in-app package wording.
- Remove legacy/ambiguous language that implies unsupported channel behavior.
- Align all package claims with current runtime order: active flow assignment first, then AI fallback.

Deliverables:

- Updated pricing copy matrix (old claim -> new claim -> source of truth).
- Finalized package capability table by channel (Facebook, Telegram, Webchat).

Exit criteria:

- No package claim conflicts with P0/P1 runtime behavior.
- Product Marketing sign-off complete.

### Phase B: Activation Onboarding (Week 1-2)

Scope:

- Add guided milestones for:
  - first connected channel
  - first automated reply
- Expose milestone progress in onboarding/admin surfaces.

Deliverables:

- Milestone definitions with event names and trigger conditions.
- UI guidance blocks linking users to the next best action.

Exit criteria:

- New tenants can complete first connection + first automated reply without support intervention.

### Phase C: Vertical Templates (Week 2)

Scope:

- Create launch templates for:
  - services
  - agencies
  - booking-heavy businesses

Deliverables:

- Template flow bundle with channel-compatible defaults.
- Template selection guidance in flow creation UX.

Exit criteria:

- Users can duplicate and activate a vertical template with minimal edits.

### Phase D: KPI Dashboard (Week 2-3)

Scope:

- Build dashboard views for activation and reliability KPIs.
- Define metric formulas and data sources per KPI.

Deliverables:

- KPI spec sheet (definition, SQL/ORM source, freshness target).
- Dashboard section with trend + current-period values.

Exit criteria:

- KPIs are visible, reproducible, and used in weekly product review.

## KPI Definitions (Initial)

1. Time to first connected channel

- Definition: elapsed time between tenant creation and first successful channel connection event.

2. Time to first automated reply

- Definition: elapsed time between tenant creation and first outbound automated reply event.

3. Weekly active tenants with active runtime mode

- Definition: unique tenants with at least one channel in active runtime behavior during the last 7 days.

4. Failed webhook setup rate

- Definition: failed webhook setup attempts / total webhook setup attempts per week.

## Immediate Next Actions

1. ✅ Lock instrumentation contract for onboarding milestones and KPI events. (COMPLETED)
2. Draft vertical template content for three target segments (Phase C).
3. Implement admin analytics dashboard view for onboarding milestone KPIs (Phase D).
4. Monitor milestone event data collection and completion rates in production.
5. Plan follow-up: template selection UI and clone-ready starter flows (Phase C).

## Acceptance Criteria

- Activation rate improves with measurable onboarding milestones.
- Marketing claims match product behavior and channel parity.

## Dependencies

- P0 and P1 workstreams
