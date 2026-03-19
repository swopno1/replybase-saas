# P0: Product Clarity and Runtime Model

Status: in-progress
Owner: Product + Engineering
Target window: 1 sprint

## Goal

Ensure users and internal teams can immediately understand what responds to a message and why.

## Tasks

1. Define canonical terminology in product copy and docs.

- Bot: routing container
- Channel: integration endpoint
- Flow: deterministic responder
- AI Engine: generative responder backend

2. Add "Effective Response Mode" section to each channel management page.

- Facebook integration
- Telegram integration
- Webchat integration

3. Publish one runtime decision tree shared by Product, Support, and Engineering.

4. Remove conflicting labels where "Builder" appears as runtime behavior.

## Implementation Progress

- done: Canonical terminology has been applied in Product_Details strategy documents and related operational docs.
- done: Effective Response Mode sections are implemented on:
  - Facebook integration page
  - Telegram integration page
  - Webchat integration page
- done: Runtime decision path is documented in operational guidance and aligned to product model.
- in-progress: Final language sweep for any remaining runtime copy that can confuse authoring (builder) with runtime behavior.

## Acceptance Criteria

- A non-technical user can answer: "What will reply if a message arrives right now?"
- Support can diagnose runtime behavior without checking code.
- Product docs use one terminology set consistently.

## Dependencies

- None
