# Product Overview: ReplyBase

## Product Positioning

ReplyBase is a multi-channel conversation platform for small and mid-size businesses that need one place to handle customer chat from website, Facebook, and Telegram.

The product combines:

- Channel connectivity (Webchat, Facebook, Telegram)
- Operational conversation handling (inbox + CRM)
- Response engines (Flows and AI)

## Vision and Mission

- Vision: become the default customer conversation operating layer for UK SMEs.
- Mission: deliver a practical "mini CRM" that can start simple and scale into automation without technical setup burden.

## Canonical Product Model (Single Source of Truth)

To keep team and roadmap aligned, this is the model we should use everywhere:

1. Workspace (Tenant): isolated account boundary.
2. Bot: response container and routing owner.
3. Channel: integration endpoint attached to a bot (web, facebook, telegram).
4. Runtime policy: per-channel decision of how to respond.
5. Responder: Flow and/or AI engine execution.

## Current Runtime Reality (As Implemented)

The response path is currently channel-specific:

- Facebook: flow-first path exists, then onboarding/default/AI logic.
- Telegram: command handling plus AI path; no generic flow assignment parity yet.
- Webchat: flow-first via bot entryFlow, then AI fallback.

This means the conceptual architecture is strong, but user mental model is inconsistent between channels.

## Core Problems We Solve

1. Fragmented communication across channels.
2. Slow first response and missed leads.
3. Manual and inconsistent lead/contact tracking.

## Product Outcome We Promise

- One inbox for customer conversations.
- Configurable automation per channel.
- CRM records created and enriched from live conversation context.
- Tenant-safe and subscription-aware operations.

## Strategic Clarification for 2026

Our next product maturity step is not adding more channels first. It is reducing operator ambiguity:

- Unify runtime controls across channels.
- Make flow deployment model channel-agnostic.
- Separate system health from feature toggles in UI.
- Keep terminology consistent across dashboard, docs, and sales messaging.

## Next Stage Expansion Plan

TikTok is the next channel candidate, but only after readiness gates are met.

### TikTok Readiness Gates

1. Runtime policy is unified across Facebook, Telegram, and Webchat.
2. Flow assignment is channel-agnostic and production-proven.
3. Diagnostics and status UX are unified for operators.
4. Production deployment playbook and rollback workflows are validated.

Once these gates are completed, TikTok should be introduced as a staged rollout:

- Stage 1: technical spike and API capability mapping.
- Stage 2: private beta with selected tenants.
- Stage 3: controlled GA with monitoring and support playbook.

## Production Deployment Strategy

Production deployment is a product feature, not only an engineering task.

Core requirements:

- Environment parity between staging and production.
- Migration safety checks and rollback plans.
- Channel-specific health checks and alerting.
- Release checklist with go or no-go criteria.
- Post-release verification for connect, webhook ingest, and reply delivery.

## Document Map

- Product details and capabilities: [Features.md](Features.md)
- Technical system and data model: [Architecture_and_DB.md](Architecture_and_DB.md)
- UI and navigation strategy: [UI_UX_Strategy.md](UI_UX_Strategy.md)
- GTM and commercial strategy: [Business_and_Marketing.md](Business_and_Marketing.md)
- Execution tasks and milestones: [todo/README.md](todo/README.md)
