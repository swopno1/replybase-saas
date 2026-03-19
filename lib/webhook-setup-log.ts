import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type WebhookSetupLogInput = {
  source: "telegram" | "facebook" | "webchat";
  event:
    | "connect_webhook"
    | "reconnect_webhook"
    | "page_connect"
    | "page_disconnect"
    | "webchat_configure";
  outcome: "setup_success" | "setup_error";
  tenantId: string;
  botId?: string;
  channelId?: string;
  webhookUrl?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Generic webhook setup logging function used across all channels (Telegram, Facebook, Webchat).
 * Logs setup attempts, successes, and failures for KPI tracking and debugging.
 */
export async function recordWebhookSetupLog(input: WebhookSetupLogInput) {
  try {
    await prisma.webhookLog.create({
      data: {
        type: input.outcome,
        source: input.source,
        event: input.event,
        data: {
          tenantId: input.tenantId,
          botId: input.botId || null,
          channelId: input.channelId || null,
          webhookUrl: input.webhookUrl || null,
          reason: input.reason || null,
          ...input.metadata,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error(
      `[Webhook Setup Log] Failed to record ${input.source} ${input.event}:`,
      error,
    );
    // Graceful error handling - don't throw to avoid disrupting the setup flow
  }
}
