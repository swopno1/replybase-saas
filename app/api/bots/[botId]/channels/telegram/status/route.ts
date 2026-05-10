import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { decryptTelegramToken } from "@/lib/telegram-crypto";
import { getTelegramWebhookInfo } from "@/lib/telegram-api";
import { checkChannelLimit } from "@/lib/subscription";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const GET = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  try {
    const { botId } = (await context.params) as { botId: string };
    const searchParams = req.nextUrl.searchParams;
    const channelId = searchParams.get("channelId");

    const whereClause: Prisma.ChannelWhereInput = channelId
      ? {
          id: channelId,
          botId,
          type: "telegram",
          bot: { tenantId: tenantId },
        }
      : {
          botId,
          type: "telegram",
          bot: { tenantId: tenantId },
        };

    const [channel, limitStatus] = await Promise.all([
      db.channel.findFirst({
        where: whereClause,
        include: {
          bot: {
            select: { id: true, name: true },
          },
          flowAssignments: {
            where: { isActive: true },
            include: {
              flow: {
                select: { id: true, name: true, isActive: true },
              },
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      }),
      checkChannelLimit(tenantId, botId),
    ]);

    if (!channel) {
      return NextResponse.json({
        connected: false,
        limitStatus,
      });
    }

    const config = (channel.config as Prisma.JsonObject | null) || {};

    const local = {
      webhookConnected: Boolean(config.webhookConnected),
      webhookUrl:
        typeof config.webhookUrl === "string" ? config.webhookUrl : null,
      lastWebhookSetAt:
        typeof config.lastWebhookSetAt === "string"
          ? config.lastWebhookSetAt
          : null,
      lastWebhookEventAt:
        typeof config.lastWebhookEventAt === "string"
          ? config.lastWebhookEventAt
          : null,
      lastInboundMessageAt:
        typeof config.lastInboundMessageAt === "string"
          ? config.lastInboundMessageAt
          : null,
      lastDeliverySuccessAt:
        typeof config.lastDeliverySuccessAt === "string"
          ? config.lastDeliverySuccessAt
          : null,
      lastDeliveryError:
        typeof config.lastDeliveryError === "string"
          ? config.lastDeliveryError
          : null,
      lastDeliveryErrorAt:
        typeof config.lastDeliveryErrorAt === "string"
          ? config.lastDeliveryErrorAt
          : null,
      lastWebhookError:
        typeof config.lastWebhookError === "string"
          ? config.lastWebhookError
          : null,
      lastWebhookErrorAt:
        typeof config.lastWebhookErrorAt === "string"
          ? config.lastWebhookErrorAt
          : null,
      lastProcessedUpdateId:
        typeof config.lastProcessedUpdateId === "number"
          ? config.lastProcessedUpdateId
          : null,
    };

    let webhookInfo = null;
    let webhookError = null;

    if (channel.accessToken) {
      try {
        const token = decryptTelegramToken(channel.accessToken);
        webhookInfo = await getTelegramWebhookInfo(token);
      } catch (error) {
        webhookError =
          error instanceof Error
            ? error.message
            : "Failed to read webhook info";
      }
    }

    return NextResponse.json({
      connected: channel.isActive && channel.enabled,
      channel: {
        id: channel.id,
        name: channel.name,
        channelId: channel.channelId,
        type: channel.type,
        updatedAt: channel.updatedAt,
        flowAssignments: (channel as any).flowAssignments,
      },
      bot: channel.bot,
      limitStatus,
      local,
      webhook: webhookInfo,
      webhookError,
    });
  } catch (error) {
    console.error("[Telegram Status] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Telegram status" },
      { status: 500 },
    );
  }
});
