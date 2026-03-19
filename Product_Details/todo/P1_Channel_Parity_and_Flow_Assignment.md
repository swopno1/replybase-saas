# P1: Channel Parity and Flow Assignment

Status: done
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
- done: Added new channel-agnostic assignment model (`FlowChannelAssignment`) with Prisma migration and regenerated Prisma client.
- done: Extended flow assignment API (`POST`/`DELETE /api/flows/:id/assign`) to support `channelId` targets while preserving legacy `pageId` behavior.
- done: Telegram and Webchat runtime now resolve active channel assignments first, then fallback to legacy `entryFlow` configuration.
- done: Added Telegram and Webchat dashboard controls to assign/unassign channel flows via the new `channelId` contract.
- done: Extended Flow Settings page with channel assignment management (select, assign, unassign) for non-Facebook channels.
- done: Added `isAdmin Boolean` field to User model with DB migration; first registered user bootstrapped as admin; bootstrap fallback if no admins exist on first global flow creation attempt.
- done: Added `isGlobal` support to `POST /api/flows` (admin-only guard); global flows visible cross-tenant via OR clause in all flow queries.
- done: Global template duplication allowed cross-tenant (`/api/flows/:id/duplicate`).
- done: Added `isAdmin` to JWT token and session (propagated through `jwt` and `session` callbacks in `lib/auth.ts` and declared in `types/next-auth.d.ts`).
- done: Added "Global Template" toggle to Create Flow dialog — visible only to admin users; passes `isGlobal: true` to the POST body.
- done: Added Admin management UI to promote/demote users from dashboard (`/admin/users`) with admin-gated APIs (`GET /api/admin/users`, `PATCH /api/admin/users/:userId`).
- done: Added migration/backfill strategy script for legacy Facebook page assignments (`scripts/backfill-facebook-flow-assignments.ts`) with dry-run and apply modes; script safely migrates unambiguous mappings and reports conflicts/skips.

## Acceptance Criteria

- Flows can be assigned and activated for all supported channels.
- Runtime behavior is consistent with selected mode.
- Existing Facebook assignments continue to work after migration.

## Dependencies

- P0 terminology and runtime mode definitions
