-- Telegram schema hardening for channel uniqueness and query performance.
-- IMPORTANT: Ensure there are no duplicate (botId,type) rows in channels before applying.

CREATE UNIQUE INDEX "channels_botId_type_key" ON "channels"("botId", "type");

CREATE INDEX "channels_botId_type_idx" ON "channels"("botId", "type");

CREATE INDEX "contact_identities_type_value_idx" ON "contact_identities"("type", "value");

CREATE INDEX "crm_conversations_contactId_botId_channel_idx" ON "crm_conversations"("contactId", "botId", "channel");
