import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMe, setTelegramWebhook } from "@/lib/telegram-api";
import { encryptTelegramToken } from "@/lib/telegram-crypto";
import { getTenantLimits } from "@/lib/subscription";
import crypto from "crypto";

export const dynamic = 'force-dynamic';

export async function POST(
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

    const validatedBot = await prisma.bot.findFirst({
      where: { id: botId, tenantId: user.tenantId },
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

    const limits = await getTenantLimits(user.tenantId);
    const currentChannels = await prisma.channel.count({
      where: { botId, type: "telegram", isActive: true },
    });

    if (currentChannels >= limits.maxChannelsPerBot) {
      return NextResponse.json(
        { error: `Channel limit reached (max ${limits.maxChannelsPerBot} per bot on your plan)` },
        { status: 403 },
      );
    }

    const encryptedToken = encryptTelegramToken(botToken);
    const webhookSecret = crypto.randomBytes(32).toString("hex");

    const name = channelName || `Telegram @${profile.username || profile.id}`;

    const channel = await prisma.channel.create({
      data: {
        tenantId: user.tenantId,
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
      await prisma.channel.update({
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
}
