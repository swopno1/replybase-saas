# Feature Gating Audit

## Current Enforcement
- **Bots**: Enforced in `app/api/bots/route.ts` via `checkBotLimits`.
- **Channels**: Enforced in `app/api/bots/[botId]/channels/route.ts` via `checkChannelLimit` (count only).
- **AI Usage**: Enforced in `lib/subscription.ts` and AI service layers.

## Missing Enforcement (Gaps to close)
- **Channel Types**: Launch plan must be restricted to Webchat and (Facebook OR WhatsApp). Currently, it only checks total count.
- **Telegram Access**: Should be restricted to Scale and Business plans.
- **API Access**: Restricted to Scale and Business (already partially gated in UI, needs API-level check).

## Implementation Plan
1. Update `PLAN_CONFIGS` in `lib/plans.ts` to include `allowedChannels`.
2. Update `checkChannelLimit` in `lib/subscription.ts` to validate the specific channel type being added.
