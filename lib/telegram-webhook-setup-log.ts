import { recordWebhookSetupLog } from "@/lib/webhook-setup-log";

type TelegramWebhookSetupLogInput = {
  tenantId: string;
  botId: string;
  channelId?: string;
  event: "connect_webhook" | "reconnect_webhook";
  outcome: "setup_success" | "setup_error";
  webhookUrl: string;
  reason?: string;
};

/**
 * Records Telegram webhook setup attempts. This is a thin wrapper around the generic
 * recordWebhookSetupLog function that maintains backward compatibility with existing
 * Telegram-specific telemetry calls.
 */
export async function recordTelegramWebhookSetupLog(
  input: TelegramWebhookSetupLogInput,
) {
  await recordWebhookSetupLog({
    source: "telegram",
    event: input.event,
    outcome: input.outcome,
    tenantId: input.tenantId,
    botId: input.botId,
    channelId: input.channelId,
    webhookUrl: input.webhookUrl,
    reason: input.reason,
  });
}
