# Features and Capabilities: ReplyBase

## 1. Available Now (Core Product)

### 1.1 Unified Inbox Foundations

- Webchat message intake and session handling.
- Telegram bot intake and webhook-backed operations.
- Unified conversation storage for active sources.

### 1.2 Conversation and Lead Operations

- Conversation and message timeline views.
- Contact identity linking.
- Lead status tracking and enrichment workflow.

### 1.3 Automation Layer

- Flow-based response handling.
- AI response handling with fallback logic.
- Bot-scoped automation ownership model.

### 1.4 Workspace and Plan Controls

- Tenant isolation and tenant-scoped resources.
- Usage limits and plan-based gating.
- Integration-level operational controls and diagnostics.

### 1.5 Security and Compliance Baseline

- Credentials and tokens protected at rest.
- Webhook authenticity controls for supported channels.
- Controlled builder access path.
- GDPR-aligned data deletion workflows.

## 2. Clarification: Current Functional Gaps

These are active product-shape gaps under improvement:

1. Inbox behavior is not fully unified across all planned sources.
2. Email and contact-form adapters are not yet fully productized.
3. Runtime controls and labels still need simplification in some areas.
4. Product terms (Bot, Flow, AI) still need tighter consistency in all UX surfaces.

## 3. Next Capability Targets

### 3.1 Source Parity for Unified Inbox

- Standardize behavior across webchat, telegram, email intake, and contact-form intake.

### 3.2 Simple Runtime Controls

- Show one explicit response mode per source:
  - Flow only
  - AI only
  - Flow then AI fallback
  - AI then Flow fallback

### 3.3 Better Operator Observability

- Single runtime decision view per source.
- Clear visibility of what replied and why.

### 3.4 Growth and Packaging

- Industry templates and onboarding packs.
- Activation-focused guidance for first connected source and first automated reply.

### 3.5 Production Deployment Excellence

- Staging-to-production release gates.
- Migration safety checks and rollback rehearsal.
- Source-level smoke tests after release.
- Alerting for webhook failures, delivery errors, and sustained 429/5xx spikes.

## 4. Feature Priorities (Current)

- P0: Product clarity and runtime simplification.
- P1: Source parity for unified inbox behavior.
- P1: Unified status and diagnostics UX.
- P2: Growth enablement and packaging.
- P0 ongoing: production deployment reliability.

## 5. Scope Guardrails

- No Facebook-focused delivery scope in current product cycle.
- TikTok remains parked until unified inbox and operational maturity goals are complete.

See implementation tasks in [todo/README.md](todo/README.md).
