# P1: Status and Diagnostics Unification

Status: planned
Owner: Engineering + Product Design
Target window: 1 sprint

## Goal

Separate system health from feature behavior and remove status ambiguity.

## Tasks

1. Define one status model for channel runtime.

- active
- paused
- disabled
- error

2. Refactor AI status UX to split:

- system health (engine connectivity)
- channel behavior (mode + toggle state)

3. Build a single diagnostics summary block reused across integrations.

- last inbound
- last outbound
- last error
- current mode

4. Add operator hints for common misconfiguration causes.

## Acceptance Criteria

- No page mixes service health and channel behavior without distinction.
- Operators can diagnose webhook/runtime state in under 30 seconds.

## Dependencies

- P0 runtime model clarity
