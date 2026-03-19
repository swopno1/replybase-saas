import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMe, setTelegramWebhook } from "@/lib/telegram-api";
import { encryptTelegramToken } from "@/lib/telegram-crypto";
import { recordTelegramWebhookSetupLog } from "@/lib/telegram-webhook-setup-log";
import {
  generateWebhookSecret,
  isLikelyTelegramBotToken,
  maskTelegramToken,
} from "@/lib/telegram-utils";
import { getTenantLimits } from "@/lib/subscription";

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
    const normalizedToken = validated.botToken.trim();

    if (!isLikelyTelegramBotToken(normalizedToken)) {
      return NextResponse.json(
        {
          error:
            "Invalid Telegram bot token format. Expected something like 123456789:ABCDEF...",
        },
        { status: 400 },
      );
    }

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

    const profile = await getMe(normalizedToken);

    const encryptedToken = encryptTelegramToken(normalizedToken);
    const defaultName =
      validated.channelName || `Telegram @${profile.username || profile.id}`;

    const telegramBotId = String(profile.id);

    // Prevent binding one Telegram bot token to multiple ReplyBase bots in the same tenant.
    const existingByTelegramBot = await prisma.channel.findFirst({
      where: {
        type: "telegram",
        channelId: telegramBotId,
        bot: {
          tenantId: user.tenantId,
        },
      },
      select: {
        id: true,
        botId: true,
      },
    });

    if (existingByTelegramBot && existingByTelegramBot.botId !== bot.id) {
      return NextResponse.json(
        {
          error:
            "This Telegram bot is already connected to another ReplyBase bot in your workspace. Disconnect it first before reconnecting here.",
        },
        { status: 409 },
      );
    }

    let channel = await prisma.channel.findFirst({
      where: {
        botId: bot.id,
        type: "telegram",
      },
    });
    const nowIso = new Date().toISOString();
    let createdChannelId: string | null = null;

    // Only check the channel limit when creating a new channel, not when updating.
    if (!channel) {
      const limits = await getTenantLimits(user.tenantId);
      const channelCount = await prisma.channel.count({
        where: { botId: bot.id },
      });
      if (channelCount >= limits.maxChannelsPerBot) {
        return NextResponse.json(
          {
            error: `Channel limit reached (max ${limits.maxChannelsPerBot} per bot on your plan)`,
          },
          { status: 403 },
        );
      }
    }

    if (!channel) {
      try {
        channel = await prisma.channel.create({
          data: {
            botId: bot.id,
            type: "telegram",
            name: defaultName,
            channelId: telegramBotId,
            isActive: false,
            enabled: false,
            killSwitch: true,
            config: {
              telegramBotId,
              botUsername: profile.username || null,
              botFirstName: profile.first_name || null,
              provisioningStartedAt: nowIso,
            } as Prisma.JsonObject,
          },
        });
        createdChannelId = channel.id;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          channel = await prisma.channel.findFirst({
            where: {
              botId: bot.id,
              type: "telegram",
            },
          });
        }

        if (!channel) {
          throw error;
        }
      }
    }

    const webhookSecret = generateWebhookSecret();
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const forwardedHost = req.headers.get("x-forwarded-host");
    const host = forwardedHost || req.headers.get("host");
    const inferredOrigin =
      forwardedProto && host
        ? `${forwardedProto}://${host}`
        : req.nextUrl.origin;
    const baseUrl =
      process.env.TELEGRAM_WEBHOOK_BASE_URL?.trim() || inferredOrigin;
    const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook/${channel.id}`;

    if (!webhookUrl.startsWith("https://")) {
      await recordTelegramWebhookSetupLog({
        tenantId: user.tenantId,
        botId: bot.id,
        channelId: channel.id,
        event: "connect_webhook",
        outcome: "setup_error",
        webhookUrl,
        reason: "Telegram requires an HTTPS webhook URL",
      });

      return NextResponse.json(
        {
          error:
            "Telegram requires an HTTPS webhook URL. Set TELEGRAM_WEBHOOK_BASE_URL to your public HTTPS domain (or tunnel URL) and try again.",
          details: {
            webhookUrl,
          },
        },
        { status: 400 },
      );
    }

    try {
      await setTelegramWebhook({
        token: normalizedToken,
        webhookUrl,
        secretToken: webhookSecret,
        allowedUpdates: ["message", "callback_query"],
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to set Telegram webhook";

      if (createdChannelId) {
        await prisma.channel
          .delete({ where: { id: createdChannelId } })
          .catch(() => {
            // Ignore cleanup failures and surface the original webhook error.
          });
      } else if (channel) {
        const currentConfig =
          (channel.config as Prisma.JsonObject | null) || {};
        await prisma.channel.update({
          where: { id: channel.id },
          data: {
            config: {
              ...currentConfig,
              lastWebhookError: message,
              lastWebhookErrorAt: nowIso,
              webhookConnected: false,
            } as Prisma.JsonObject,
          },
        });
      }

      await recordTelegramWebhookSetupLog({
        tenantId: user.tenantId,
        botId: bot.id,
        channelId: channel?.id,
        event: "connect_webhook",
        outcome: "setup_error",
        webhookUrl,
        reason: message,
      });

      throw error;
    }

    const currentConfig = (channel.config as Prisma.JsonObject | null) || {};

    const updatedChannel = await prisma.channel.update({
      where: { id: channel.id },
      data: {
        name: defaultName,
        channelId: telegramBotId,
        accessToken: encryptedToken,
        isActive: true,
        enabled: true,
        killSwitch: false,
        config: {
          ...currentConfig,
          telegramBotId,
          botUsername: profile.username || null,
          botFirstName: profile.first_name || null,
          connectedAt: currentConfig.connectedAt || nowIso,
          webhookSecret,
          webhookUrl,
          webhookConnected: true,
          lastWebhookSetAt: nowIso,
          lastWebhookError: null,
          lastWebhookErrorAt: null,
        } as Prisma.JsonObject,
      },
    });

    await recordTelegramWebhookSetupLog({
      tenantId: user.tenantId,
      botId: bot.id,
      channelId: updatedChannel.id,
      event: "connect_webhook",
      outcome: "setup_success",
      webhookUrl,
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
      tokenMasked: maskTelegramToken(normalizedToken),
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
