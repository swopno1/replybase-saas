# P2: TikTok Next-Stage Plan

Status: planned
Owner: Product + Engineering + Marketing
Target window: after channel parity milestone

## Goal

Launch TikTok as a controlled, high-confidence channel after core runtime consistency is achieved.

## Entry Gates

1. Runtime policy parity across Facebook, Telegram, and Webchat.
2. Unified diagnostics UX and support runbook.
3. Production deployment checklist and rollback process validated.

## Tasks

1. Discovery and compliance mapping

- Confirm TikTok API capabilities and limitations for messaging/webhooks.
- Define data retention and compliance requirements.

2. Architecture and data model design

- Define TikTok channel config contract.
- Define identity mapping into ContactIdentity.
- Define webhook verification and replay protection strategy.

3. Build and internal validation

- Implement connect, status, webhook, disconnect, and diagnostics paths.
- Add end-to-end tests and webhook replay tests.

4. Private beta rollout

- Select limited tenants by segment.
- Track reliability and onboarding friction metrics.

5. GA readiness

- Publish setup guide and support SOP.
- Enable gradual rollout switch.

## Acceptance Criteria

- Tenants can connect TikTok with guided setup.
- Inbound messages reliably create or continue conversations.
- Outbound replies and telemetry meet service targets.
- No regression to existing channel reliability.

## Dependencies

- P0_Product_Clarity_and_Runtime_Model
- P1_Channel_Parity_and_Flow_Assignment
- P1_Status_And_Diagnostics_Unification
- P0_Production_Deployment_Excellence
