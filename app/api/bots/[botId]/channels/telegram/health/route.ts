import { NextResponse } from "next/server";
import { decryptTelegramToken } from "@/lib/telegram-crypto";
import { getTelegramWebhookInfo } from "@/lib/telegram-api";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const GET = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  try {
    const { botId } = (await context.params) as { botId: string };
    const searchParams = req.nextUrl.searchParams;
    const channelId = searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 });
    }

    const channel = await db.channel.findFirst({
      where: {
        id: channelId,
        botId,
        type: "telegram",
        bot: { tenantId: tenantId },
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
});
