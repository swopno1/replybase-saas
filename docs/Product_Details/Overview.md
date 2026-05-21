# Product Overview: ReplyBase

## Product Positioning

ReplyBase is a Unified Business Inbox for small and mid-size businesses.

It helps teams:

- see all customer messages in one place
- reply faster from one dashboard
- manage leads without switching tools

Current focus channels:

- Website chat
- Telegram
- Email intake (roadmap)
- Contact form intake (roadmap)

Facebook is intentionally out of active product focus for now.

## Vision and Mission

- Vision: become the simplest day-to-day customer messaging workspace for SMEs.
- Mission: make response operations and lead capture practical for non-technical teams.

## Canonical Product Model (Single Source of Truth)

1. Workspace (Tenant): isolated business account boundary.
2. Inbox Source: where messages come from (webchat, telegram, email, form).
3. Bot: response container that owns automation settings.
4. Responder: Flow and/or AI engine.
5. Lead Record: structured customer and conversation outcome data.

## Runtime Promise

For each inbox source, operators should always understand:

- what will respond
- in which order (Flow, AI, or fallback)
- where the result appears in inbox and lead records

## Core Problems We Solve

1. Customer messages scattered across tools.
2. Slow or inconsistent replies.
3. Leads captured in chat but lost operationally.

## Product Outcome We Promise

- One place to read and reply to customer messages.
- Simple automation setup for Flow and AI.
- Lead and contact records created from live conversations.
- Tenant-safe and subscription-aware operations.

## Strategic Clarification for 2026

Priority is product clarity and reliable operations, not rapid channel expansion.

Near-term focus:

- Unified inbox behavior across active sources.
- Clear and simple Flow, Bot, AI setup model.
- Better diagnostics and deployment reliability.
- Practical growth tooling for activation and retention.

## Channel Scope Decision

- In scope now: Website chat, Telegram, Inbox unification, Lead operations.
- In planning: Email and Contact form adapters.
- Parked: Facebook-first workflows and TikTok expansion until core inbox model is fully stable.

## Production Deployment Strategy

Production deployment is part of product quality.

Core requirements:

- Environment parity between staging and production.
- Migration safety checks and rollback plans.
- Source-specific health checks and alerting.
- Release checklist with go/no-go criteria.
- Post-release verification for receive, route, and reply delivery.

## Document Map

- Product details and capabilities: [Features.md](Features.md)
- Technical system and data model: [Architecture_and_DB.md](Architecture_and_DB.md)
- UI and navigation strategy: [UI_UX_Strategy.md](UI_UX_Strategy.md)
- GTM and commercial strategy: [Business_and_Marketing.md](Business_and_Marketing.md)
- Execution tasks and milestones: [todo/README.md](todo/README.md)
