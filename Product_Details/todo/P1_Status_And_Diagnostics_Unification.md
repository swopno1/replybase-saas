# P1: Status and Diagnostics Unification

Status: in-progress  
Owner: Engineering + Product Design  
Target window: 1 sprint

## Goal

Separate system health from runtime behavior and provide one diagnostics model across inbox sources.

## Tasks

1. Define one status model for runtime behavior.

- active / paused / disabled / error

2. Keep AI/system health and source behavior separate in UI.

- System health in dedicated health surfaces
- Source behavior in integration/source pages

3. Build reusable diagnostics summary.

- Current response mode
- Last inbound and outbound activity
- Last error and suggested fix
- Source health snapshot

4. Add operator troubleshooting hints.

- Common misconfiguration causes
- Quick remediation actions
- Links to runbook sections

## Acceptance Criteria

- No page mixes service health and source behavior without distinction.
- Operators can diagnose runtime state in under 30 seconds.
- Diagnostics summary format is consistent across active and planned sources.

## Dependencies

- P0_Product_Clarity_and_Runtime_Model
