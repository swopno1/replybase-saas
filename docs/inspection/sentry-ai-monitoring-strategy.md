# Sentry AI & Automation Monitoring Strategy

## 1. The Challenge
AI failures are often silent (hallucinations) or transient (timeouts). Traditional error tracking misses these operational nuances.

## 2. Structured Tagging for AI
Every AI invocation should be decorated with:
- `ai.provider`: (e.g., `digitalocean`, `openai`)
- `ai.model`: (e.g., `llama3.1-70b`)
- `ai.task`: (e.g., `intent-detection`, `fallback-generation`)
- `ai.is_fallback`: (boolean)
- `bot_id`: The ID of the bot performing the task.

## 3. Latency Tracing
Wrap `streamText` and `generateObject` in Sentry spans:
```typescript
const span = Sentry.startSpan({ name: "AI Invocation", op: "ai.generate" }, () => {
  // ... call AI SDK
});
```
This allows us to visualize AI provider latency trends directly in Sentry Performance.

## 4. AI Specific Error Handling
- **Guardrail Hits**: Capture "Prompt Injection Detected" as a breadcrumb or warning event.
- **Provider Timeouts**: Specifically tag `ECONNABORTED` or AI SDK timeouts to differentiate from application bugs.
- **Fallback Events**: Log when the system switches to the fallback provider as a "Message" event (not exception) to track reliability without consuming error quota.

## 5. Correlation IDs
Ensure the `flow_execution_id` or `conversation_id` is attached to every AI-related error to allow end-to-end debugging of a failed conversation.

---
