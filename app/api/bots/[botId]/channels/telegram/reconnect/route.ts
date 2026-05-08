import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setTelegramWebhook } from "@/lib/telegram-api";
import { decryptTelegramToken } from "@/lib/telegram-crypto";

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

    const body = await req.json();
    const { channelId } = body;

    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        botId,
        type: "telegram",
        bot: { tenantId: user.tenantId },
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
}
