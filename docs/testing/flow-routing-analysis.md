# Flow Routing Analysis

## Orchestration Logic
The system uses the `last_user_message_normalized` variable to drive the initial intent classification in the Master Flow.

## Observed Routing Paths
1. **Direct Match**: User clicks "Pricing" button -> Immediate jump to Pricing Flow.
2. **Natural Language**: User types "how much does it cost" -> Condition node matches "cost" -> Jump to Pricing Flow.
3. **Complex Query**: User types "can you integrate with my custom ERP?" -> Flow doesn't match -> AI Fallback answers technical details + nudges to Demo.

## Integrity Checks
- **Dead End Check**: ALL sub-flows have been verified to either return to the hub or end with a clear CTA.
- **Recursion Check**: No infinite flow-calling-flow loops detected.

---
*Routing Analysis performed by Lead Conversational Architect.*
