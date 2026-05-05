import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  answerTelegramCallbackQuery,
} from "@/lib/telegram-api";
import { decryptTelegramToken } from "@/lib/telegram-crypto";
import { messageQueue } from "@/lib/queue";
import {
  TelegramUpdate,
  getTelegramChatId,
  getTelegramText,
  getTelegramUserDisplayName,
  getTelegramUserId,
  isTelegramCommand,
  normalizeTelegramText,
} from "@/lib/telegram-utils";

export const dynamic = "force-dynamic";

function getCommandReply(commandText: string): string | null {
  const command = commandText.split(" ")[0]?.toLowerCase();

  if (command === "/help") {
    return "You can ask me questions directly. Use /settings to view integration settings in ReplyBase.";
  }

  if (command === "/settings") {
    return "Settings are managed in your ReplyBase dashboard under Telegram integration.";
  }

  return null;
}

async function updateTelegramChannelConfig(
  channelId: string,
  currentConfig: Prisma.JsonObject | null,
  patch: Record<string, unknown>,
) {
  const nextConfig = {
    ...((currentConfig || {}) as Prisma.JsonObject),
    ...patch,
  } as Prisma.JsonObject;

  await prisma.channel.update({
    where: { id: channelId },
    data: {
      config: nextConfig,
    },
  });

  return nextConfig;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId } = await params;

    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        type: "telegram",
        isActive: true,
        enabled: true,
      },
      include: {
        bot: {
          select: {
            id: true,
            tenantId: true,
            name: true,
            entryFlow: true,
          },
        },
      },
    });

    if (!channel || !channel.bot) {
      await prisma.webhookLog
        .create({
          data: {
            type: "skipped",
            source: "telegram",
            event: `skip_inactive:${channelId}`,
            data: {
              reason: "channel_not_found_or_inactive",
            } as Prisma.InputJsonValue,
          },
        })
        .catch(() => {
          // Best effort only.
        });
      return NextResponse.json({ success: true }, { status: 200 });
    }

    let config = (channel.config as Prisma.JsonObject | null) || {};
    const expectedSecret =
      typeof config.webhookSecret === "string" ? config.webhookSecret : null;
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");

    if (!expectedSecret) {
      await prisma.webhookLog
        .create({
          data: {
            type: "security_error",
            source: "telegram",
            event: `missing_secret:${channelId}`,
            data: {
              reason: "webhook_secret_not_configured",
            } as Prisma.InputJsonValue,
          },
        })
        .catch(() => {
          // Best effort only.
        });

      return NextResponse.json(
        { error: "Webhook secret is not configured" },
        { status: 403 },
      );
    }

    // Use timing-safe comparison to prevent secret oracle timing attacks.
    const matches =
      secretHeader !== null &&
      secretHeader.length === expectedSecret.length &&
      crypto.timingSafeEqual(
        Buffer.from(secretHeader),
        Buffer.from(expectedSecret),
      );
    if (!matches) {
      await prisma.webhookLog
        .create({
          data: {
            type: "security_error",
            source: "telegram",
            event: `invalid_secret:${channelId}`,
            data: {
              reason: "invalid_webhook_secret_header",
            } as Prisma.InputJsonValue,
          },
        })
        .catch(() => {
          // Best effort only.
        });

      return NextResponse.json(
        { error: "Invalid webhook secret" },
        { status: 403 },
      );
    }

    const update = (await req.json()) as TelegramUpdate;
    const eventAt = new Date().toISOString();

    const updateId = update.update_id;
    if (typeof updateId === "number") {
      const eventKey = `update:${channelId}:${updateId}`;
      const existing = await prisma.webhookLog.findFirst({
        where: {
          source: "telegram",
          event: eventKey,
        },
        select: { id: true },
      });

      if (existing) {
        return NextResponse.json(
          { success: true, duplicate: true },
          { status: 200 },
        );
      }

      await prisma.webhookLog.create({
        data: {
          type: "update",
          source: "telegram",
          event: eventKey,
          data: update as unknown as Prisma.InputJsonValue,
        },
      });
    }

    config = await updateTelegramChannelConfig(channel.id, config, {
      webhookConnected: true,
      lastWebhookEventAt: eventAt,
      lastProcessedUpdateId: typeof updateId === "number" ? updateId : null,
    });

    const tokenEncrypted = channel.accessToken;
    if (!tokenEncrypted) {
      await prisma.webhookLog
        .create({
          data: {
            type: "config_error",
            source: "telegram",
            event: `missing_token:${channelId}`,
            data: {
              reason: "missing_encrypted_token",
            } as Prisma.InputJsonValue,
          },
        })
        .catch(() => {
          // Best effort only.
        });
      return NextResponse.json({ success: true }, { status: 200 });
    }

    let token: string;
    try {
      token = decryptTelegramToken(tokenEncrypted);
    } catch (error) {
      await prisma.webhookLog
        .create({
          data: {
            type: "config_error",
            source: "telegram",
            event: `decrypt_token_error:${channelId}`,
            data: {
              reason:
                error instanceof Error
                  ? error.message
                  : "Unable to decrypt token",
            } as Prisma.InputJsonValue,
          },
        })
        .catch(() => {
          // Best effort only.
        });
      return NextResponse.json({ success: false }, { status: 500 });
    }

    if (update.callback_query?.id) {
      await answerTelegramCallbackQuery(token, update.callback_query.id);
    }

    const chatId = getTelegramChatId(update);
    const userId = getTelegramUserId(update);
    const messageText = getTelegramText(update);

    if (!chatId || !userId || !messageText) {
      return NextResponse.json(
        { success: true, skipped: true },
        { status: 200 },
      );
    }

    const userName = getTelegramUserDisplayName(update);

    await messageQueue.add("telegram-message", {
      type: "telegram",
      payload: { channel, update, chatId, userId, messageText, userName },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const { channelId } = await params;
    await prisma.webhookLog
      .create({
        data: {
          type: "internal_error",
          source: "telegram",
          event: `internal_error:${channelId}`,
          data: {
            error:
              error instanceof Error ? error.message : "Unknown internal error",
          } as Prisma.InputJsonValue,
        },
      })
      .catch(() => {
        // Best effort only.
      });

    console.error("[Telegram Webhook] Error:", error);
    // Return 500 so Telegram retries transient failures; de-dup uses update_id.
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
