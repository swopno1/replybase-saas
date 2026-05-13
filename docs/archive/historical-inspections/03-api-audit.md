# Codebase Audit: API Routes & Integrations

## 1. Duplicate Facebook Integration Routes (CRITICAL)
There are two sets of Facebook integration routes that perform overlapping or identical functions. This is a source of confusion and technical debt.

### Set A: Multi-Bot Architecture (The Future)
These routes are bot-specific and align with the new multi-tenant, multi-bot architecture.
- `/api/bots/[botId]/channels/facebook`
- `/api/bots/[botId]/channels/facebook/[pageId]`
- `/api/bots/[botId]/channels/facebook/reconnect`
- `/api/bots/[botId]/channels/facebook/[pageId]/check-connection`
- `/api/bots/[botId]/channels/facebook/[pageId]/toggle-ai-engine`

### Set B: Legacy Integration Routes (POSSIBLY DEPRECATED)
These routes are being phased out but are still used in some places like `ai-toggle.tsx`.
- `/api/integrations/facebook`
- `/api/integrations/facebook/auth`
- `/api/integrations/facebook/pages`
- `/api/integrations/facebook/pages/[pageId]/toggle-ai-engine`

**Recommendation:** Consolidate all Facebook channel management to the `/api/bots/[botId]/channels/facebook` pattern. Update `ai-toggle.tsx` to use the bot-specific route.

## 2. Unused or Experimental API Routes (SAFE TO DELETE)
The following routes have no frontend usage or are development-only artifacts:

- `/api/admin/tests`: While used by an admin page, it's a security risk in production if not strictly guarded.
- `/api/meta/setup-status`: Appears unused.
- `/api/health`: Redundant with `/api/system-health`.
- `/api/facebook/disconnect`: Disconnect logic should be handled through the bot channel API.

## 3. Data Deletion Logic
- There is overlap between `/api/data-deletion` (General) and `/api/facebook/data-deletion` (Facebook specific).
- Facebook requires a specific callback URL for data deletion requests. This is correctly handled in `/api/facebook/data-deletion/route.ts`.

## 4. Cron Jobs
- `/api/cron/*` routes are triggered by external schedulers. These are active and should be kept, but they must be secured (e.g., via `cron-auth.ts`).

## 5. Summary Recommendations
- **Complete the Migration**: Move remaining usages of `/api/integrations/facebook` to `/api/bots/[botId]/channels/facebook`.
- **Remove Orphaned Routes**: Delete `/api/meta/setup-status` and `/api/health`.
