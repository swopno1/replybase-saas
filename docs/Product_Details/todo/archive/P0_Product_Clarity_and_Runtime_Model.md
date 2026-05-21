# P0: Product Clarity and Runtime Model

Status: in-progress
Owner: Product + Engineering
Target window: 1 sprint

## Goal

Ensure users and internal teams can immediately understand what responds to a message and why, using a unified inbox model.

## Tasks

1. Define canonical terminology in product copy and docs.

- Bot: routing container
- Source: integration endpoint (webchat, telegram, email, form)
- Flow: deterministic responder
- AI: generative responder backend

2. Add "Effective Response Mode" section to each source management page.

- Telegram integration
- Webchat integration
- Email integration (when shipped)
- Contact-form intake settings (when shipped)

3. Publish one runtime decision tree shared by Product, Support, and Engineering.

4. Remove conflicting labels where "Builder" appears as runtime behavior.

## Implementation Progress

- done: Canonical terminology updated in Product_Details strategy docs.
- in-progress: Runtime labels being normalized from channel-centric to source-centric wording.
- in-progress: Effective Response Mode pattern retained for active sources and queued for email/form surfaces.
- planned: Final pass on dashboard copy to remove residual ambiguous labels.

## Acceptance Criteria

- A non-technical user can answer: "What will reply if a message arrives right now?"
- Support can diagnose runtime behavior without checking code.
- Product docs use one terminology set consistently.

## Dependencies

- None
