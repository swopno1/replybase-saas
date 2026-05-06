# Proposal: Multi-Bot Multi-Channel Architecture

## Overview
Currently, the application supports multiple bots per tenant, but the channel configuration (WhatsApp, Facebook, Telegram) is largely treated as a singleton per tenant or restricted by unique constraints that prevent multiple instances of the same channel type for a single bot.

This proposal outlines the transformation to a **Bot-Centric** architecture where each bot is an independent entity with its own dedicated channel integrations. One user (tenant) can activate multiple bots, and each bot can have its own independent connection to Webchat, Facebook, WhatsApp, and Telegram.

---

## 1. Schema & Data Model Changes

### Channel Model Refactor
The current `Channel` model has a unique constraint `@@unique([botId, type])`. This must be removed to allow a single bot to potentially manage multiple numbers or tokens of the same type.

**Changes:**
- Remove `@@unique([botId, type])`.
- Ensure `channelId` (the external provider ID, e.g., Phone Number ID or Telegram Bot ID) is unique across the system or at least within the provider type to ensure webhook routing remains deterministic.
- Add `tenantId` to the `Channel` model for easier indexing and isolation (it currently relies on the relation through `Bot`).

### Consolidating Other Integration Models
- **FacebookPage**: Ensure every `FacebookPage` is strictly linked to a `Bot`. Currently, `botId` is optional; it should become required once the migration is complete.
- **WebChatSite**: Already linked to a `Bot`, but ensure the UI enforces this relationship during creation.

---

## 2. Bot-Centric Integration Management

### UI Navigation Refactor
- Move integration settings from the global sidebar into a tab within the Bot Detail page: `/bots/[botId]/channels`.
- This ensures that when a user configures WhatsApp, they are doing so *for a specific bot*.

### API Scoping
- Update connection endpoints:
  - From: `POST /api/whatsapp/connect`
  - To: `POST /api/bots/[botId]/channels/whatsapp/connect`
- This pattern should be applied to all channels.

---

## 3. Webhook Routing Hardening

To support multiple bots/channels of the same type, we must improve the lookup logic in webhook handlers.

### WhatsApp Webhook (`app/api/whatsapp/webhook/route.ts`)
- Instead of fetching all active WhatsApp channels for a tenant, the webhook should:
  1. Extract the `phoneNumberId` (for Meta) or `To` number (for Twilio).
  2. Perform a global lookup: `prisma.channel.findFirst({ where: { channelId: extractedId, type: 'whatsapp' }, include: { bot: true } })`.
  3. Pass the `botId` to the background worker (`whatsapp-worker.ts`).

### Facebook Webhook (`app/api/facebook/webhook/route.ts`)
- Use the `pageId` from the incoming payload to find the specific `FacebookPage` record.
- Route the message to the `botId` associated with that page.

---

## 4. Subscription & Entitlements

The `Plan` model already contains `maxBots` and `maxChannelsPerBot`. These should be strictly enforced:
- **Bot Creation**: Check `tenant.bots.count() < plan.maxBots`.
- **Channel Connection**: Check `bot.channels.count() < plan.maxChannelsPerBot`.

---

## 5. Migration Strategy
1. **Schema Update**: Apply Prisma migrations to loosen unique constraints.
2. **Data Correction**: Run a script to ensure every existing `Tenant` has a "Default Bot" and all orphan channels are linked to it.
3. **Dual-Path Routing**: Temporarily support both old and new lookup methods in webhooks to avoid downtime during rollout.
