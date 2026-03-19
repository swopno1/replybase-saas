# UI and UX Strategy: ReplyBase

## 1. Design Goal

Make ReplyBase feel simple to operate even when the backend is complex.

Primary principle: every operator should immediately understand what will reply to an incoming message and why.

## 2. UX Problems To Solve

1. Terminology overlap between Bot, Flow, Builder, and AI Engine.
2. Channel-specific behavior hidden behind separate pages.
3. Status labels that indicate system health and feature behavior in the same place.

## 3. Core UX Principles (2026)

- Clarity before density: show effective behavior first, advanced config second.
- One mental model across channels.
- Explainability: every toggle should include expected runtime effect.
- Progressive complexity: default setup for non-technical users, advanced controls for power users.

## 4. Proposed Navigation and Information Architecture

### 4.1 Primary Navigation

- Conversations
- Contacts and Leads
- Bots
- Channels
- Flows
- Runtime and Health
- Settings

### 4.2 Why This Structure

- Bots define ownership and routing context.
- Channels define external connectivity and per-channel behavior.
- Flows define automation logic.
- Runtime and Health reveals effective behavior and system state separately.

## 5. Runtime UX Pattern (Must-Have)

For each channel, show an "Effective Response Mode" card:

- Current mode: Flow only, AI only, Flow then AI fallback, AI then Flow fallback
- Active flow (if any)
- AI availability and reason if unavailable
- Last successful inbound/outbound timestamps
- Last error and suggested fix

This card should appear in Facebook, Telegram, and Webchat management views.

## 6. Content and Labeling Standards

- Use "Bot" to mean routing container.
- Use "Flow" to mean deterministic rule-based responder.
- Use "AI Engine" to mean generative responder backend.
- Use "Builder" only for authoring tools, never runtime status.

## 7. UI Delivery Priorities

- P0: unify status language and response mode visibility.
- P1: channel-agnostic runtime settings and diagnostics layout.
- P2: template gallery, flow preview sandbox, and guided optimization suggestions.

See execution tasks in [todo/README.md](todo/README.md).
