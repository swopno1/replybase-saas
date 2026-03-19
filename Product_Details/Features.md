# Features and Capabilities: ReplyBase

## 1. Available Now (Core Product)

### 1.1 Multi-Channel Intake

- Webchat widget capture and session handling.
- Facebook integration with webhook-based processing.
- Telegram bot integration with webhook provisioning and diagnostics.

### 1.2 Conversation Operations

- Unified conversation and message storage.
- Contact and identity linking across channels.
- Lead status and contact enrichment workflows.

### 1.3 Automation Layer

- Flow-based automated conversation handling.
- AI conversation capability with session continuity.
- Channel-specific fallback behavior (current behavior differs by channel).

### 1.4 Workspace and Plan Controls

- Tenant isolation and tenant-scoped resources.
- Usage limits and plan-based gating.
- Channel-level operational controls and health telemetry.

### 1.5 Security and Compliance Baseline

- Token encryption at rest.
- Secret-based webhook verification for Telegram.
- OIDC-secured builder access path.
- GDPR-aligned data deletion workflows.

## 2. Clarification: Current Functional Gaps

These are not failures; they are active product-shape gaps we are addressing:

1. Flow deployment is not fully channel-parity today.
2. AI status UX is centered around Facebook semantics.
3. Runtime controls are represented by multiple flags with overlapping meaning.
4. Product terms (Bot, Flow, Builder, Engine) can be interpreted inconsistently by users.

## 3. Next Capability Targets

### 3.1 Channel-Parity Automation

- Standardize flow assignment and runtime policy across Facebook, Telegram, and Webchat.

### 3.2 Unified Runtime Controls

- Show one explicit response mode per channel:
  - Flow only
  - AI only
  - Flow then AI fallback
  - AI then Flow fallback

### 3.3 Better Operator Observability

- Single runtime decision view per channel.
- Clear visibility of what will respond and why.

### 3.4 Commercial Expansion

- Industry templates and onboarding packs.
- Additional channels only after runtime model consistency is completed.

### 3.5 TikTok Next-Stage Plan

- Stage 1: capability and policy validation
  - Validate official API scope for messaging, webhook events, and auth constraints.
  - Map TikTok identity and conversation context to ContactIdentity and CrmConversation.
- Stage 2: limited tenant beta
  - Controlled rollout to a small cohort with explicit success criteria.
  - Channel-level diagnostics and failure telemetry tuned for TikTok event patterns.
- Stage 3: general availability
  - Enable guided setup in dashboard.
  - Publish runbook and support SOP for onboarding, troubleshooting, and escalation.

### 3.6 Production Deployment Excellence

- Staging to production promotion with release gates.
- Migration safety checks and rollback rehearsal.
- Per-channel smoke tests after release.
- Alerting for webhook failures, delivery errors, and sustained 429 or 5xx spikes.
- Release health dashboard and 24-hour post-deploy verification window.

## 4. Feature Priorities (Current)

- P0: Product clarity and runtime consistency.
- P1: Cross-channel flow deployment parity.
- P1: Unified status and diagnostics UX.
- P2: TikTok staged rollout and advanced automation packs.
- P0 ongoing: production deployment reliability and release safety.

See implementation tasks in [todo/README.md](todo/README.md).
