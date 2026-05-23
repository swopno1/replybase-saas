import { NextResponse } from "next/server";
import { getMe, setTelegramWebhook } from "@/lib/telegram-api";
import { encryptTelegramToken } from "@/lib/telegram-crypto";
import { checkChannelLimitWithType } from "@/lib/subscription";
import crypto from "crypto";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const POST = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  try {
    const { botId } = (await context.params) as { botId: string };

    const validatedBot = await db.bot.findFirst({
      where: { id: botId, tenantId: tenantId },
    });

    if (!validatedBot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const body = await req.json();
    const { botToken, channelName } = body;

    if (!botToken) {
      return NextResponse.json({ error: "Bot token is required" }, { status: 400 });
    }

    let profile;
    try {
      profile = await getMe(botToken);
    } catch (e) {
      return NextResponse.json({ error: "Invalid Telegram bot token" }, { status: 400 });
    }

    const limitStatus = await checkChannelLimitWithType(tenantId, botId, "telegram");
    if (!limitStatus.allowed) {
      return NextResponse.json(
        {
          error: limitStatus.error,
          details: limitStatus.message,
        },
        { status: 403 },
      );
    }

    const encryptedToken = encryptTelegramToken(botToken);
    const webhookSecret = crypto.randomBytes(32).toString("hex");

    const name = channelName || `Telegram @${profile.username || profile.id}`;

    const channel = await db.channel.create({
      data: {
        tenantId: tenantId,
        botId,
        type: "telegram",
        name,
        channelId: String(profile.id),
        accessToken: encryptedToken,
        config: {
          username: profile.username,
          firstName: profile.first_name,
          webhookSecret,
        },
      },
    });

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
      await db.channel.update({
        where: { id: channel.id },
        data: { isActive: false },
      });
      return NextResponse.json({ error: "Failed to set Telegram webhook" }, { status: 500 });
    }

    return NextResponse.json({ success: true, channelId: channel.id });
  } catch (error) {
    console.error("[Telegram Connect] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
