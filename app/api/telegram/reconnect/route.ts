import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setTelegramWebhook } from "@/lib/telegram-api";
import { decryptTelegramToken } from "@/lib/telegram-crypto";
import { generateWebhookSecret } from "@/lib/telegram-utils";
import { recordTelegramWebhookSetupLog } from "@/lib/telegram-webhook-setup-log";

export const dynamic = 'force-dynamic';




const reconnectSchema = z.object({
  channelId: z.string().min(1),
});

/**
 * POST /api/telegram/reconnect
 *
 * Re-registers the Telegram webhook for an already-connected channel using the
 * stored (encrypted) bot token.  Useful when Telegram marks the webhook as
 * failed or when the public URL changes (e.g. after a deployment/domain change).
 * No need to re-enter the bot token.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = reconnectSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    const channel = await prisma.channel.findFirst({
      where: {
        id: validated.channelId,
        type: "telegram",
        bot: { tenantId: user.tenantId },
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "Telegram channel not found" },
        { status: 404 },
      );
    }

    if (!channel.accessToken) {
      return NextResponse.json(
        {
          error:
            "No token stored for this channel. Please reconnect with your bot token.",
        },
        { status: 400 },
      );
    }

    const token = decryptTelegramToken(channel.accessToken);
    const nowIso = new Date().toISOString();

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
        botId: channel.botId,
        channelId: channel.id,
        event: "reconnect_webhook",
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

    const currentConfig = (channel.config as Prisma.JsonObject | null) || {};

    try {
      await setTelegramWebhook({
        token,
        webhookUrl,
        secretToken: webhookSecret,
        allowedUpdates: ["message", "callback_query"],
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reconnect webhook";
      await prisma.channel.update({
        where: { id: channel.id },
        data: {
          config: {
            ...currentConfig,
            webhookConnected: false,
            lastWebhookError: message,
            lastWebhookErrorAt: nowIso,
          } as Prisma.JsonObject,
        },
      });

      await recordTelegramWebhookSetupLog({
        tenantId: user.tenantId,
        botId: channel.botId,
        channelId: channel.id,
        event: "reconnect_webhook",
        outcome: "setup_error",
        webhookUrl,
        reason: message,
      });

      throw error;
    }

    await prisma.channel.update({
      where: { id: channel.id },
      data: {
        isActive: true,
        enabled: true,
        killSwitch: false,
        config: {
          ...currentConfig,
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
      botId: channel.botId,
      channelId: channel.id,
      event: "reconnect_webhook",
      outcome: "setup_success",
      webhookUrl,
    });

    return NextResponse.json({ success: true, webhookUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 },
      );
    }

    console.error("[Telegram Reconnect] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to reconnect webhook",
      },
      { status: 500 },
    );
  }
}
