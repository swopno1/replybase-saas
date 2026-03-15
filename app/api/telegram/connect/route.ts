import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMe, setTelegramWebhook } from "@/lib/telegram-api";
import { encryptTelegramToken } from "@/lib/telegram-crypto";
import { generateWebhookSecret, maskTelegramToken } from "@/lib/telegram-utils";

const connectSchema = z.object({
  botId: z.string().min(1),
  botToken: z.string().min(10),
  channelName: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = connectSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    const bot = await prisma.bot.findFirst({
      where: { id: validated.botId, tenantId: user.tenantId },
      select: { id: true },
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const profile = await getMe(validated.botToken);

    const encryptedToken = encryptTelegramToken(validated.botToken);
    const defaultName =
      validated.channelName || `Telegram @${profile.username || profile.id}`;

    let channel = await prisma.channel.findFirst({
      where: {
        botId: bot.id,
        type: "telegram",
      },
    });

    if (!channel) {
      channel = await prisma.channel.create({
        data: {
          botId: bot.id,
          type: "telegram",
          name: defaultName,
          channelId: String(profile.id),
          accessToken: encryptedToken,
          isActive: true,
          enabled: true,
          killSwitch: false,
          config: {
            telegramBotId: String(profile.id),
            botUsername: profile.username || null,
            botFirstName: profile.first_name || null,
            connectedAt: new Date().toISOString(),
          } as Prisma.JsonObject,
        },
      });
    }

    const webhookSecret = generateWebhookSecret();
    const baseUrl = process.env.TELEGRAM_WEBHOOK_BASE_URL || req.nextUrl.origin;
    const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook/${channel.id}`;

    await setTelegramWebhook({
      token: validated.botToken,
      webhookUrl,
      secretToken: webhookSecret,
      allowedUpdates: ["message", "callback_query"],
    });

    const currentConfig = (channel.config as Prisma.JsonObject | null) || {};

    const updatedChannel = await prisma.channel.update({
      where: { id: channel.id },
      data: {
        name: defaultName,
        channelId: String(profile.id),
        accessToken: encryptedToken,
        isActive: true,
        enabled: true,
        killSwitch: false,
        config: {
          ...currentConfig,
          telegramBotId: String(profile.id),
          botUsername: profile.username || null,
          botFirstName: profile.first_name || null,
          webhookSecret,
          webhookUrl,
          webhookConnected: true,
          lastWebhookSetAt: new Date().toISOString(),
        } as Prisma.JsonObject,
      },
    });

    return NextResponse.json({
      success: true,
      channelId: updatedChannel.id,
      bot: {
        id: profile.id,
        username: profile.username,
        firstName: profile.first_name,
      },
      webhookUrl,
      tokenMasked: maskTelegramToken(validated.botToken),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }

    console.error("[Telegram Connect] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to connect Telegram",
      },
      { status: 500 },
    );
  }
}
