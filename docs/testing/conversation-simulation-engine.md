# Conversation Simulation Engine

## Functional Specification

### Execution Loop
The simulation engine follows the same logic as the production worker:
1. Receive Input (Message or Trigger).
2. Resolve/Resume Session.
3. Execute Flow Nodes (Message, Action, Condition, etc.).
4. Invoke AI if fallback is triggered.
5. Capture Responses and State Changes.

### Simulation-Specific Logic
In `lib/bot-entry-flow-engine.ts`, the following logic is applied when `isSimulation` is true:
- `persistLeadCapture`: Instead of updating the `Lead` model, it accumulates changes in the `variables` object and flags them as "Extracted Data".
- `dispatchWebhook`: Logic is executed, but the actual HTTP call is skipped, and the event is logged in the simulation trace.
- `activityLog`: Logs are created with a `SIMULATION` prefix or stored in a separate temporary collection.

### AI Reasoning Inspector
The engine captures:
- System prompt used.
- Full conversation history sent to the AI.
- Model response and token usage.
- Function/Tool call attempts.

### Scenarios
Predefined scenarios are stored as JSON templates that inject specific messages and initial variables to test specific paths (e.g., "Angry Customer", "Pricing Query").

## Advanced Testing Features

The engine supports simulating various edge cases and stress tests:
- **Sequential Runner**: Automates a sequence of messages to test long-form conversations.
- **Delayed Response**: Simulates network latency or slow AI responses.
- **Rapid-fire Simulation**: Sends multiple messages in quick succession to test race conditions and idempotency.
- **Multi-language**: Injects language-specific headers or variables to test internationalization flows.
- **Error Injection**:
    - **AI Timeout**: Simulates a failure in the AI service.
    - **Duplicate Webhooks**: Sends the same event twice to verify idempotency logic.
    - **Missing Variables**: Skips required variables to test fallback/error handling.
    - **Subscription Limits**: Simulates a tenant reaching their message or lead quota.
