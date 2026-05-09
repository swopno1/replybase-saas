# Codebase Audit: Libraries & Utilities

## 1. Orphaned Logic (SAFE TO DELETE)
The following files in `/lib` have 0 references in the application code:
- `lib/flow-execution-engine.ts` (Legacy, replaced by `bot-entry-flow-engine.ts`)
- `lib/subscription-middleware.ts` (Redundant)
- `lib/telegram-webhook-setup-log.ts` (Replaced by generic `webhook-setup-log.ts`)

## 2. Utility Duplication & Overlap
- **Facebook Utilities**: `lib/facebook-sender.ts` vs `lib/server/facebook-utils.ts`. There is significant overlap in how Meta Graph API calls are handled.
- **Webhook Logging**: `lib/webhook-setup-log.ts` and `lib/telegram-webhook-setup-log.ts` (already identified as unused).
- **KPI/Analytics**: `lib/admin-activation-kpis.ts` and `lib/segmented-activation-kpis.ts` have similar data aggregation logic.

## 3. Webchat Logic Bloat
The webchat system has grown complex and logic is spread across many files:
- `lib/webchat.ts`
- `lib/webchat-conversation-engine.ts`
- `lib/webchat-cors.ts`
- `lib/webchat-diagnostics.ts`
- `lib/webchat-metrics.ts`
- `lib/webchat-session.ts`
- `lib/webchat-telemetry.ts`

While modular, some of these (like `metrics` and `telemetry`) could potentially be consolidated to reduce file count.

## 4. Environment Variable Handling
- `lib/env.ts` is heavily used (169 references). This is good for type safety, but the memory notes indicated a discrepancy between Upstash REST and Redis TCP configurations.

## 5. Recommendations
- **Purge 0-reference files**: Immediately remove the files listed in section 1.
- **Consolidate Facebook Logic**: Merge `facebook-sender.ts` and `facebook-utils.ts` into a single Meta service.
- **Audit Webchat Modules**: Review if webchat-specific telemetry and metrics can be merged into the general `analytics.ts` or a single `webchat-analytics.ts`.
