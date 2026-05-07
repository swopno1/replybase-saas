# Multi-Stage Development Prompts: Multi-Bot Architecture

These prompts are designed to be executed sequentially by an AI developer to transform the application into a multi-bot, multi-channel platform.

---

## Stage 1: Database & Schema Refactor ✅
**Goal**: Update the Prisma schema to support multiple channels of the same type per bot and ensure bot-centricity.

> "Update the Prisma schema to support multiple channels of the same type per bot and ensure bot-centricity.
> 1. Remove the unique constraint `@@unique([botId, type])` from the `Channel` model in `prisma/schema.prisma`.
> 2. Add a unique constraint `@@unique([type, channelId])` (or ensure that `channelId` is unique for the provider type) to ensure webhook routing remains deterministic.
> 3. Verify that `FacebookPage` and `WebChatSite` both have a required `botId`.
> 4. Create a migration and a seed script that ensures every existing `Tenant` has at least one 'Default Bot' and that all existing channels/pages are linked to it."

---

## Stage 2: Bot-Specific Channel APIs ✅
**Goal**: Refactor the backend API routes for WhatsApp, Telegram, and Webchat to be bot-specific.

> "Refactor the backend API routes for WhatsApp, Telegram, and Webchat to be bot-specific.
> 1. Move or update the connection endpoints (e.g., `api/whatsapp/connect`) to accept or include `botId` in the path: `api/bots/[botId]/channels/whatsapp/connect`.
> 2. Update the logic to verify that the `botId` belongs to the user's `tenantId`.
> 3. Ensure that 'Disconnect' logic only removes the specific channel instance for that bot, not all channels of that type for the tenant."

---

## Stage 3: Integration UI Migration ✅
**Goal**: Redesign the Integration UI to be part of the Bot management flow.

> "Redesign the Integration UI to be part of the Bot management flow.
> 1. Create a new 'Channels' or 'Integrations' tab within `app/(dashboard)/bots/[botId]/page.tsx`.
> 2. Move the existing configuration forms from `app/(dashboard)/integrations/*` into this new bot-specific view.
> 3. Update the navigation so that clicking 'WhatsApp' in the main sidebar (if it remains) first asks the user to 'Select a Bot' or redirects to the primary bot's WhatsApp settings.
> 4. Ensure the 'Bot Selection' dropdown is removed from the connection forms since the bot context is now provided by the URL/parent component."

---

## Stage 4: Webhook ## Stage 4: Webhook & Routing Hardening Routing Hardening ✅
**Goal**: Audit and update the webhook handlers for all messaging channels to support the multi-bot architecture.

> "Audit and update the webhook handlers for all messaging channels to support the multi-bot architecture.
> 1. In `app/api/whatsapp/webhook/route.ts`, ensure that when a message arrives, the `phoneNumberId` is used to find the specific `Channel` record globally, and the `botId` from that record is passed to the worker.
> 2. Repeat this for Facebook (`pageId`) and Telegram (where the URL already contains the `channelId`).
> 3. Update the background workers (`lib/services/*-worker.ts`) to ensure they use the `botId` provided in the job payload to fetch bot-specific context and flows."

---

## Stage 5: Subscription Enforcement ✅
**Goal**: Implement strict limit enforcement for the multi-bot feature.

> "Implement strict limit enforcement for the multi-bot feature.
> 1. In `lib/subscription.ts`, create a utility function `checkBotLimits(tenantId)` that compares the current bot count against `plan.maxBots`.
> 2. Apply this check to the Bot Creation API.
> 3. Create a similar check for `maxChannelsPerBot` and apply it to the Channel Connection APIs.
> 4. Update the Frontend to disable 'Create Bot' buttons and show an 'Upgrade Plan' tooltip when limits are reached."
