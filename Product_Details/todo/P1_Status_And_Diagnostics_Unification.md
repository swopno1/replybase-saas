# P1: Status and Diagnostics Unification

Status: in-progress
Owner: Engineering + Product Design
Target window: 1 sprint

## Goal

Separate system health from feature behavior and remove status ambiguity.

## Tasks

1. Define one status model for channel runtime.

- ✅ active / paused / disabled / error states defined in codebase

2. Refactor AI status UX to split:

- ✅ System health (engine connectivity) shown in `/ai-status` page
- ⚠️ Channel behavior (mode + toggle state) visible per-integration page; unified format pending

3. Build a single diagnostics summary block reused across integrations.

- ✅ Telegram integration page shows diagnostic info (lastInbound, lastOutbound, currentMode)
- ✅ Webchat integration page shows diagnostic summary
- ⚠️ Facebook integration page lacks diagnostic summary block (legacy implementation)
- ⚠️ Generic DiagnosticSummary component for reuse across all channels not yet extracted

4. Add operator hints for common misconfiguration causes.

- ⚠️ Individual integration pages have some guidance; centralized operator handbook pending

## Implementation Progress

- done: AI status refactoring to separate system health from channel behavior
- done: Telegram and Webchat integration pages have diagnostic summary sections
- done: Status states (active/paused/disabled/error) defined and used in runtime logic
- in-progress: Extract reusable DiagnosticSummary component for all channels
- in-progress: Add diagnostic hints and troubleshooting guidance to all integration pages
- planned: Unified operator handbook with common misconfiguration causes and remediation steps

## Acceptance Criteria

- No page mixes service health and channel behavior without distinction.
- Operators can diagnose webhook/runtime state in under 30 seconds.

## Dependencies

- P0 runtime model clarity
