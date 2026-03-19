# P1: Channel Parity and Flow Assignment

Status: planned
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

## Acceptance Criteria

- Flows can be assigned and activated for all supported channels.
- Runtime behavior is consistent with selected mode.
- Existing Facebook assignments continue to work after migration.

## Dependencies

- P0 terminology and runtime mode definitions
