export const SUPPORTED_WEBHOOK_EVENTS = [
  "lead.created",
  "lead.updated",
  "conversation.new_message",
  "contact.updated",
  "bot.flow_completed",
] as const;

export type WebhookEventType = typeof SUPPORTED_WEBHOOK_EVENTS[number];
