# P1: Channel Parity and Flow Assignment

Status: in-progress
Owner: Engineering
Target window: 1-2 sprints

## Goal

Provide consistent flow deployment behavior across Facebook, Telegram, and Webchat.

## Tasks

1. Redesign flow assignment model to be channel-agnostic.

- Option A: generic assignment target fields
- Option B: channel-specific assignment tables with unified service layer

2. Implement Telegram flow assignment support.

3. Align Webchat entry flow and assignment strategy.

4. Add migration and backfill plan for existing Facebook assignments.

## Implementation Progress

- done: Added reusable non-Facebook bot entry-flow runtime engine (`lib/bot-entry-flow-engine.ts`) for channel parity work.
- done: Telegram webhook now attempts bot entry flow first (when `bot.entryFlow` is configured), then falls back to AI.
- in-progress: Define and implement channel-agnostic assignment model for Facebook, Telegram, and Webchat.
- pending: Migration and backfill strategy for existing Facebook page assignments.

## Acceptance Criteria

- Flows can be assigned and activated for all supported channels.
- Runtime behavior is consistent with selected mode.
- Existing Facebook assignments continue to work after migration.

## Dependencies

- P0 terminology and runtime mode definitions
