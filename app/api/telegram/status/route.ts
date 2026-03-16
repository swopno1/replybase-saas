import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptTelegramToken } from "@/lib/telegram-crypto";
import { getTelegramWebhookInfo } from "@/lib/telegram-api";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const channelId = searchParams.get("channelId");
    const botId = searchParams.get("botId");

    const whereClause: Prisma.ChannelWhereInput = channelId
      ? {
          id: channelId,
          type: "telegram",
          bot: { tenantId: user.tenantId },
        }
      : {
          botId: botId || undefined,
          type: "telegram",
          bot: { tenantId: user.tenantId },
        };

    const channel = await prisma.channel.findFirst({
      where: whereClause,
      include: {
        bot: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (!channel) {
      return NextResponse.json({
        connected: false,
      });
    }

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
      },
      bot: channel.bot,
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
}
