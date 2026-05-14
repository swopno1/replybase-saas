# Admin QA Tools

## Simulation Lab UI Components

### 1. Chat Simulator
- Standard chat interface for interacting with the bot.
- "Persona" selector (e.g., New Lead, Returning Customer).
- "Scenario" selector for automated multi-step tests.

### 2. Flow Execution Timeline
- Visual list of every node visited during the session.
- Success/Failure status for each node.
- Input/Output variables for each step.

### 3. CRM & Memory Inspector
- Real-time view of the "Virtual Lead" data.
- List of tags that *would* have been applied.
- Current variable state (Memory).

### 4. Technical Trace
- AI logs (latency, model, tokens).
- Error logs for broken transitions or missing variables.
- Integration logs (Webhooks that would have fired).

## Exporting Reports
Admins can export the full simulation result as:
- **JSON**: Full technical trace for developers.
- **Markdown**: Formatted transcript and summary for stakeholders.
- **PDF**: Summary report with "Pass/Fail" indicators.
