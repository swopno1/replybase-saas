# Technical Architecture and Database Setup: ReplyBase

## 1. Runtime Architecture (Current)

ReplyBase is a multi-tenant unified inbox platform.

### Stack

- Next.js App Router (dashboard and API routes)
- TypeScript (application layer)
- Prisma + PostgreSQL (data layer)
- NextAuth (auth and tenant session context)

### Response Engines

- Flow engine (deterministic)
- AI engine (generative)

### Source Intake Paths

- Webchat message route
- Telegram webhook route
- Email/contact-form adapters (planned and staged)

## 2. Canonical Entity Relationships

1. Tenant owns users, bots, contacts, subscriptions, and source resources.
2. Bot is the routing container for response behavior.
3. Source integration attaches a bot to an inbound origin (webchat, telegram, email, form).
4. Conversation and message tables store normalized communication history.
5. Contact plus ContactIdentity resolve cross-source identity.
6. Flow and FlowNode define rule-based response logic.

## 3. Important Current Constraints

### 3.1 Source Behavior Is Not Fully Uniform

- Webchat and Telegram are more mature operationally.
- Email and contact-form intake still need full parity rollout.

### 3.2 Runtime Settings Need Simplification

Multiple status flags across pages and integrations still create operator ambiguity in some surfaces.

### 3.3 Inbox Model Needs Stronger Parity

Unified inbox promise depends on consistent ingestion, routing, and lead mapping across active and planned sources.

## 4. Data Model Summary (Operational)

- Tenant, User, Plan, Subscription
- Bot, Channel (source adapter)
- Contact, ContactIdentity
- CrmConversation, CrmMessage
- Flow, FlowNode, FlowSession, FlowAssignment
- WebChatSite
- SystemHealth, WebhookLog

## 5. Multi-Tenancy and Security

- Tenant scoping is required for management endpoints and data access.
- Source credentials are encrypted at rest.
- Webhook authenticity controls are required for external source intake.
- Subscription gating remains enforced for key operational actions.

## 6. Target Architecture Improvements

### P0

- Introduce one clear runtime policy concept per source.
- Separate health reporting from behavior configuration.

### P1

- Normalize source adapters so behavior is consistent across webchat, telegram, email, and forms.
- Harmonize message decision trees and lead capture outputs.

### P2

- Expand only after unified inbox parity and diagnostics maturity are validated.

## 7. Scope Guardrails

- No Facebook-first engineering priority in this product cycle.
- TikTok expansion remains parked until inbox parity, diagnostics, and deployment quality are consistently stable.

## 8. Production Deployment Plan (Improved)

### 8.1 Release Gates

1. Migrations validated in production-like staging data.
2. Source smoke tests pass (receive, route, reply, lead creation).
3. Alerting and dashboards active before release.
4. Rollback path verified and owner on-call confirmed.

### 8.2 Deployment Steps

1. Freeze release scope and publish change summary.
2. Apply schema changes with pre-check scripts and backup checkpoint.
3. Deploy application.
4. Run post-deploy verification matrix by source.
5. Monitor 24-hour stabilization window.

### 8.3 Post-Deploy Controls

- Track ingestion success rate per source.
- Track outbound delivery success and retry behavior.
- Escalate on sustained 429 or 5xx patterns.
- Capture incident learnings and update runbooks.

## 9. Testing and Validation Focus

- Unit and integration tests for routing decisions and fallback behavior.
- E2E tests per source for receive, respond, and diagnostics.
- Migration-safe database changes with production-like data checks.

Execution backlog is tracked in [todo/README.md](todo/README.md).
