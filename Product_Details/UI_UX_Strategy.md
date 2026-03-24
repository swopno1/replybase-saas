# UI and UX Strategy: ReplyBase

## 1. Design Goal

Make ReplyBase feel like one practical inbox workspace for daily operations.

Primary principle: any operator should understand in seconds what will reply and where lead outcomes are recorded.

## 2. UX Problems To Solve

1. Terminology overlap between Bot, Flow, and AI.
2. Source-specific behavior split across separate mental models.
3. Status labels that mix system health with runtime behavior.

## 3. Core UX Principles (2026)

- Clarity before density: show effective behavior first, advanced config second.
- One mental model across inbox sources.
- Explainability: every toggle should include expected runtime effect.
- Progressive complexity: easy defaults for non-technical users, advanced controls for power users.

## 4. Proposed Navigation and Information Architecture

### 4.1 Primary Navigation

- Inbox
- Contacts and Leads
- Bots
- Sources
- Flows
- Runtime and Health
- Settings

### 4.2 Why This Structure

- Inbox is the daily operator home.
- Bots define response ownership.
- Sources define message intake connectors.
- Flows define automation logic.
- Runtime and Health separates behavior from system status.

## 5. Runtime UX Pattern (Must-Have)

For each source, show an "Effective Response Mode" card:

- Current mode: Flow only, AI only, Flow then AI fallback, AI then Flow fallback
- Active flow (if any)
- AI availability and reason if unavailable
- Last successful inbound/outbound timestamps
- Last error and suggested fix

This card should appear in Webchat, Telegram, and upcoming Email/Form source management views.

## 6. Content and Labeling Standards

- Use "Bot" to mean routing container.
- Use "Flow" to mean deterministic rule-based responder.
- Use "AI" to mean generative responder backend.
- Use "Builder" only for authoring tools, never runtime status.
- Use "Source" for intake connector terminology in operator-facing UI.

## 7. UI Delivery Priorities

- P0: simplify language and response mode visibility.
- P1: source-agnostic runtime settings and diagnostics layout.
- P2: template gallery, flow preview sandbox, and guided optimization.

## 8. Scope Guardrail

- No Facebook-first UX investment in the current cycle.
- Email and contact-form experiences should align to the same source model as webchat and telegram.

See execution tasks in [todo/README.md](todo/README.md).
