# Legacy Reference Cleanup

## Target Keywords
- `starter`
- `pro`

## Locations to Update/Remove
- `public/embed/replybase-webchat.js`: Change default `planName` from "pro" to "launch" (or make it dynamic).
- `lib/plans.ts`: Keep the aliases for backward compatibility but mark as `@deprecated`.
- `lib/env.ts`: Keep legacy Price ID variables for existing deployments but prioritize new ones.


## Residual References (August 2026 Audit)
The following files still contain "starter" or "pro" but are considered safe or internal:
- `app/api/auth/register/route.ts`: Handles legacy signup redirects (Required for stability).
- `app/api/cron/trial-reminders/route.ts`: Maps legacy plan names to new names for old trials (Required).
- `lib/billing-service.ts`: Normalized plan resolver (Required for backward compatibility).
- `docs/templates/`: Static JSON templates for demo flows.
