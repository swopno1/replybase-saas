import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptTelegramToken } from "@/lib/telegram-crypto";
import { getTelegramWebhookInfo } from "@/lib/telegram-api";

export const dynamic = 'force-dynamic';




/**
 * GET /api/bots/[botId]/channels/telegram/health?channelId=<id>
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { botId } = await params;
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    const channelId = req.nextUrl.searchParams.get("channelId");
    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 },
      );
    }

    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        botId,
        type: "telegram",
        bot: { tenantId: user.tenantId },
      },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if (!channel.accessToken) {
      return NextResponse.json(
        { error: "Channel has no token" },
        { status: 400 },
      );
    }

    const token = decryptTelegramToken(channel.accessToken);
    const webhookInfo = await getTelegramWebhookInfo(token);

    return NextResponse.json({
      status: "ok",
      webhook: webhookInfo,
    });
  } catch (error) {
    console.error("[Telegram Health] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to check health",
      },
      { status: 500 },
    );
  }
}
