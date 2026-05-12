# Orchestrator Architecture Review (V6 Final)

## Current State
The V6 Orchestrator relies on a "Flow First, AI Second" hierarchy. 

### Strengths
- **Cost Control**: Deterministic flows handle ~70% of common intents (pricing, demo, booking) at zero AI cost.
- **State Preservation**: BullMQ and Redis ensure that conversation state is preserved across reloads.
- **Identity Stitching**: The `session_hash` method is technically sound and avoids CRM duplication.

### Weaknesses Found & Fixed
- **Naming Divergence**: The database flow names were out of sync with the orchestrator templates. **FIXED**: Synced names to `Sub-Flow: ...` format.
- **Fallback Blocking**: The flow engine's default fallback message was preventing AI from taking over during orchestrator handovers. **FIXED**: Implemented `shouldFallbackToAi` logic in `bot-entry-flow-engine.ts`.
- **Model Ghosting**: Fictional model names (`gemini-3.1`) were causing provider-level 404s. **FIXED**: Reverted to `gemini-1.5-flash` for high-reliability production use.

## Recommended Improvements
1. **Dynamic Intent Slotting**: Instead of simple regex/contains, use the "Fast Intent Classifier" (Layer 2) to resolve the `nextNodeOrder` in the condition node.
2. **Sentiment-Based Routing**: Trigger human escalation immediately if sentiment score < -0.6.

---
*Reviewed by Omnichannel Systems Architect.*
