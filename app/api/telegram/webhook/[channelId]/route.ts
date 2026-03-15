import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { converse } from "@/lib/ai-engine";
import {
  answerTelegramCallbackQuery,
  sendTelegramTextMessage,
} from "@/lib/telegram-api";
import { decryptTelegramToken } from "@/lib/telegram-crypto";
import {
  TelegramUpdate,
  getTelegramChatId,
  getTelegramText,
  getTelegramUserDisplayName,
  getTelegramUserId,
  isTelegramCommand,
} from "@/lib/telegram-utils";

function getCommandReply(commandText: string): string | null {
  const command = commandText.split(" ")[0]?.toLowerCase();

  if (command === "/start") {
    return "Welcome to ReplyBase. Send a message and I will help you right away.";
  }

  if (command === "/help") {
    return "You can ask me questions directly. Use /settings to view integration settings in ReplyBase.";
  }

  if (command === "/settings") {
    return "Settings are managed in your ReplyBase dashboard under Telegram integration.";
  }

  return null;
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
          },
        },
      },
    });

    if (!channel || !channel.bot) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const config = (channel.config as Prisma.JsonObject | null) || {};
    const expectedSecret =
      typeof config.webhookSecret === "string" ? config.webhookSecret : null;
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");

    if (expectedSecret && secretHeader !== expectedSecret) {
      return NextResponse.json(
        { error: "Invalid webhook secret" },
        { status: 403 },
      );
    }

    const update = (await req.json()) as TelegramUpdate;

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

    const tokenEncrypted = channel.accessToken;
    if (!tokenEncrypted) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const token = decryptTelegramToken(tokenEncrypted);

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

    const tenantId = channel.bot.tenantId;
    const userName = getTelegramUserDisplayName(update);

    let contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        identities: {
          some: {
            type: "telegram_user_id",
            value: userId,
          },
        },
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId,
          name: userName,
          identities: {
            create: [
              { type: "telegram_user_id", value: userId },
              { type: "telegram_chat_id", value: chatId },
            ],
          },
        },
      });
    } else {
      await prisma.contactIdentity.upsert({
        where: {
          contactId_type_value: {
            contactId: contact.id,
            type: "telegram_chat_id",
            value: chatId,
          },
        },
        update: {},
        create: {
          contactId: contact.id,
          type: "telegram_chat_id",
          value: chatId,
        },
      });

      if (!contact.name && userName) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { name: userName },
        });
      }
    }

    let conversation = await prisma.crmConversation.findFirst({
      where: {
        contactId: contact.id,
        botId: channel.bot.id,
        channel: "telegram",
      },
    });

    if (!conversation) {
      conversation = await prisma.crmConversation.create({
        data: {
          contactId: contact.id,
          botId: channel.bot.id,
          channel: "telegram",
        },
      });
    }

    await prisma.crmMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "inbound",
        content: messageText,
        source: "human",
      },
    });

    let replyText = getCommandReply(messageText);

    if (!replyText || !isTelegramCommand(messageText)) {
      try {
        const aiResponse = await converse({
          botId: channel.bot.id,
          tenantId,
          contact: {
            name: userName,
          },
          message: messageText,
        });

        type TextResponse = { type: "text"; text?: string };
        const textResponse = aiResponse.responses?.find(
          (response: TextResponse) =>
            response.type === "text" && Boolean(response.text),
        );

        if (textResponse?.text) {
          replyText = textResponse.text;
        }
      } catch (error) {
        console.error("[Telegram Webhook] AI error:", error);
      }
    }

    if (!replyText) {
      replyText =
        "Sorry, I could not process that right now. Please try again in a moment.";
    }

    const sendResult = await sendTelegramTextMessage(token, chatId, replyText);

    if (sendResult.success) {
      await prisma.crmMessage.create({
        data: {
          conversationId: conversation.id,
          direction: "outbound",
          content: replyText,
          source: isTelegramCommand(messageText) ? "system" : "ai",
        },
      });
    } else {
      await prisma.webhookLog.create({
        data: {
          type: "delivery_error",
          source: "telegram",
          event: `send_error:${channelId}`,
          data: {
            chatId,
            userId,
            error: sendResult.error || "Unknown Telegram send error",
            retryAfterSeconds: sendResult.retryAfterSeconds || null,
          } as Prisma.InputJsonValue,
        },
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Telegram Webhook] Error:", error);
    // Return 200 to prevent excessive retries for transient internal failures.
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
