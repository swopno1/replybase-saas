# Simulation Lab Architecture

## Overview
The Simulation Lab is a specialized environment within the ReplyBase Admin Panel designed for testing and QA of conversational bots. It allows administrators to simulate complex user interactions without affecting production data, billing, or real messaging channels.

## Core Components

### 1. Simulation Engine (Extension of Flow Engine)
The Simulation Lab leverages the existing `bot-entry-flow-engine.ts` but executes in a "Sandbox Mode".
- **Sandbox Mode**: When enabled, the engine suppresses side effects such as:
    - Real outbound message dispatching.
    - Webhook triggers to external systems.
    - Production CRM updates.
    - Billing/usage incrementing.
- **Traceability**: The engine returns an execution trace (ExecutionLog) for each step, which the UI uses to visualize the flow path.

### 2. Simulation API
A new set of administrative endpoints (`/api/admin/subscribers/[id]/simulate`) handles:
- Simulation session lifecycle (Start, Message, Reset).
- Mocking of subscriber/contact context.
- Execution of predefined scenarios.

### 3. State Management
- **Simulation Sessions**: Uses a transient state (either in-memory, Redis, or a flagged database record) to track the conversation progress.
- **Mock CRM**: Captures lead extraction results in a virtual "Simulation Lead" object returned to the UI for inspection.

## Data Isolation & Safety
- **Tenant Scope**: All simulations are strictly scoped to the selected tenant.
- **Flagging**: Any logs generated during simulation are marked with `isSimulation: true`.
- **Channel Virtualization**: Channels (WhatsApp, Webchat, etc.) are virtualized. The engine treats them as targets for logic branching but skips actual provider API calls.

## Integration Points
- **AI Service**: Uses the real `getAiModel` but can be configured to use specific "Test" models or simulate specific responses.
- **Flow Runtime**: Uses the production `interpolateText`, `evaluateCondition`, and `resolveReferencedFlow` to ensure behavior parity.
