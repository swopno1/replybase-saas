# P1: Source Parity and Flow Assignment

Status: in-progress  
Owner: Engineering  
Target window: 1-2 sprints

## Goal

Provide consistent Flow/Bot/AI runtime behavior across webchat, telegram, email intake, and contact-form intake.

## Tasks

1. Keep flow assignment model source-agnostic.

- Preserve generic assignment target contract.
- Keep service layer independent from source-specific UI semantics.

2. Align active sources (webchat and telegram).

- Use the same assignment resolution order.
- Keep fallback behavior consistent and documented.

3. Extend parity to planned sources.

- Apply assignment/runtime contract to email intake adapter.
- Apply assignment/runtime contract to contact-form adapter.

4. Preserve backward compatibility.

- Keep legacy source-specific behavior isolated and non-blocking.
- Ensure migration and fallback paths do not break existing tenants.

## Acceptance Criteria

- Flows can be assigned and activated for all supported inbox sources.
- Runtime behavior is consistent with selected mode.
- Legacy behavior does not block unified inbox rollout.

## Dependencies

- P0_Product_Clarity_and_Runtime_Model
