import { NextResponse } from "next/server";
import { setTelegramWebhook } from "@/lib/telegram-api";
import { decryptTelegramToken } from "@/lib/telegram-crypto";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const POST = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  try {
    const { botId } = (await context.params) as { botId: string };
    const body = await req.json();
    const { channelId } = body;

    const channel = await db.channel.findFirst({
      where: {
        id: channelId,
        botId,
        type: "telegram",
        bot: { tenantId: tenantId },
      },
    });

    if (!channel || !channel.accessToken) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const botToken = decryptTelegramToken(channel.accessToken);
    const config = (channel.config as any) || {};
    const webhookSecret = config.webhookSecret;

    if (!webhookSecret) {
      return NextResponse.json({ error: "Webhook secret missing" }, { status: 400 });
    }

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
    const baseUrl = host.includes("localhost") ? "http://localhost:3000" : `${forwardedProto}://${host}`;
    const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook/${channel.id}`;

    try {
      await setTelegramWebhook({
        token: botToken,
        webhookUrl,
        secretToken: webhookSecret
      });
    } catch (e) {
      return NextResponse.json({ error: "Failed to reconnect Telegram webhook" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Telegram Reconnect] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
