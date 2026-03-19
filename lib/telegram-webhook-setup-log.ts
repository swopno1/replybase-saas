import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TelegramWebhookSetupLogInput = {
  tenantId: string;
  botId: string;
  channelId?: string;
  event: "connect_webhook" | "reconnect_webhook";
  outcome: "setup_success" | "setup_error";
  webhookUrl: string;
  reason?: string;
};

export async function recordTelegramWebhookSetupLog(
  input: TelegramWebhookSetupLogInput,
) {
  try {
    await prisma.webhookLog.create({
      data: {
        type: input.outcome,
        source: "telegram",
        event: input.event,
        data: {
          tenantId: input.tenantId,
          botId: input.botId,
          channelId: input.channelId || null,
          webhookUrl: input.webhookUrl,
          reason: input.reason || null,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("[Telegram Webhook Setup Log] Failed to record log:", error);
  }
}
