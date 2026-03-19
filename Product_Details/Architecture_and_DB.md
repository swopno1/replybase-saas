# Technical Architecture and Database Setup: ReplyBase

## 1. Runtime Architecture (Current)

ReplyBase is a multi-tenant, channel-driven conversation platform.

### Stack

- Next.js 16 App Router (dashboard and API routes)
- TypeScript (application layer)
- Prisma + PostgreSQL (data layer)
- NextAuth (auth and tenant session context)

### Response Engines

- Flow engine (internal)
- AI engine via Typebot APIs (external)

### Channel Intake Paths

- Facebook webhook route
- Telegram webhook route
- Webchat message route

## 2. Canonical Entity Relationships

1. Tenant owns users, bots, contacts, subscriptions, and channel resources.
2. Bot is the routing container for response behavior.
3. Channel connects a bot to a source channel (web, facebook, telegram).
4. Conversation and message tables store normalized communication history.
5. Contact plus ContactIdentity resolve cross-channel identity.
6. Flow and FlowNode define rule-based conversation logic.

## 3. Important Current Constraints

### 3.1 Channel Behavior Is Not Fully Uniform

- Facebook includes page-centric logic and flow assignment behavior.
- Telegram currently relies mainly on command handling and AI path.
- Webchat uses bot entryFlow and flow-first handling.

### 3.2 Flow Assignment Model Is Channel-Specific

Flow assignment is currently tied to Facebook pages, which limits channel parity for flow deployment.

### 3.3 Runtime Flags Need Consolidation

Multiple status switches exist across bot/channel/page/conversation levels. This increases operator ambiguity and code-branch complexity.

## 4. Data Model Summary (Operational)

- Tenant, User, Plan, Subscription
- Bot, Channel
- Contact, ContactIdentity
- CrmConversation, CrmMessage
- Flow, FlowNode, FlowSession, FlowAssignment
- FacebookPage, WebChatSite
- SystemHealth, WebhookLog

## 5. Multi-Tenancy and Security

- Tenant scoping is required for management endpoints and data access.
- Channel credentials are encrypted at rest.
- Webhook authenticity controls are required for external channel intake.
- Subscription gating remains enforced for key builder/runtime actions.

## 6. Target Architecture Improvements

### P0

- Introduce a single runtime policy concept per channel.
- Separate health reporting from behavior configuration.

### P1

- Generalize flow assignment from Facebook-only to channel-agnostic targets.
- Harmonize message decision trees across channels.

### P2

- Expand channels only after runtime policy and diagnostics are unified.

## 7. Next Stage TikTok Architecture Plan

### 7.1 Scope

- Add TikTok as a channel integration with the same canonical model:
  - Bot ownership
  - Channel runtime policy
  - Conversation and message persistence
  - Unified diagnostics and observability

### 7.2 Data and Integration Blueprint

- Add new channel type and channel config schema for TikTok credentials and webhook metadata.
- Map TikTok user/thread identifiers into ContactIdentity.
- Reuse CrmConversation and CrmMessage normalization pipeline.
- Ensure tenant-scoped authorization and secret handling match existing channel standards.

### 7.3 Rollout Strategy

1. Technical spike and schema draft in staging.
2. Internal sandbox verification with webhook replay tests.
3. Limited beta with operational telemetry review.
4. GA after SLO and error-rate thresholds are met.

## 8. Production Deployment Plan (Improved)

### 8.1 Release Gates

1. All migrations validated in production-like staging data.
2. Channel smoke tests pass (connect, status, inbound webhook, outbound reply).
3. Alerting hooks and dashboards are active before release.
4. Rollback command path verified and owner on-call confirmed.

### 8.2 Deployment Steps

1. Freeze release scope and publish change summary.
2. Apply schema changes with pre-check scripts and backup checkpoint.
3. Deploy application.
4. Run post-deploy verification matrix by channel.
5. Monitor 24-hour stabilization window.

### 8.3 Post-Deploy Controls

- Track webhook ingestion success rate per channel.
- Track outbound delivery success and retry rates.
- Escalate on sustained 429 or 5xx patterns.
- Capture incident learnings and update runbooks.

## 9. Testing and Validation Focus

- Unit and integration tests for routing decisions and fallbacks.
- E2E tests per channel for connect, receive, respond, and diagnostics.
- Migration-safe database changes with production-like data checks.

Execution backlog is tracked in [todo/README.md](todo/README.md).
