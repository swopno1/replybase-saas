import { prisma } from "@/lib/prisma";
import { ModelMessage } from "ai";
import {
  sendTelegramChatAction,
  sendTelegramTextMessage,
} from "@/lib/telegram-api";
import { waitForFlowDurationMs } from "@/lib/flow-runtime-utils";
import { executeBotEntryFlowFirst } from "@/lib/bot-entry-flow-engine";
import { decryptTelegramToken } from "@/lib/telegram-crypto";
import {
  normalizeTelegramText,
} from "@/lib/telegram-utils";
import { recordMilestoneEvent } from "@/lib/milestone-events";
import logger from "@/lib/logger";

function getCommandReply(commandText: string): string | null {
  const command = commandText.split(" ")[0]?.toLowerCase();
  if (command === "/help") return "You can ask me questions directly. Use /settings to view integration settings in ReplyBase.";
  if (command === "/settings") return "Settings are managed in your ReplyBase dashboard under Telegram integration.";
  return null;
}

export async function processTelegramJob(payload: any) {
  const { channel, update, chatId, userId, messageText, userName, botId } = payload;
  const targetBotId = botId || channel.botId;
  const tenantId = channel.bot.tenantId;

  const tokenEncrypted = channel.accessToken;
  if (!tokenEncrypted) return;
  const token = decryptTelegramToken(tokenEncrypted);

  let contact = await prisma.contact.findFirst({
    where: {
      tenantId,
      identities: { some: { type: "telegram_user_id", value: userId } },
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
  }

  let conversation = await prisma.crmConversation.findFirst({
    where: { contactId: contact.id, botId: targetBotId, channel: "telegram" },
  });

  if (!conversation) {
    conversation = await prisma.crmConversation.create({
      data: {
        tenantId,
        contactId: contact.id,
        botId: targetBotId,
        channel: "telegram",
      },
    });
  }

  await prisma.crmMessage.create({
    data: {
      tenantId,
      conversationId: conversation.id,
      direction: "inbound",
      content: messageText,
      source: "human",
    },
  });

  // Bot Status check
  const bot = await prisma.bot.findUnique({
    where: { id: targetBotId },
    select: { enabled: true, entryFlow: true }
  });
  if (!bot || !bot.enabled) return;

  const commandName = messageText.split(" ")[0]?.toLowerCase();
  const isStartCommand = commandName === "/start";
  let replyText = isStartCommand ? null : getCommandReply(messageText);
  let replySource: "system" | "flow" | "ai" = replyText ? "system" : "ai";

  if (!replyText) {
    try {
      const flowResult = await executeBotEntryFlowFirst({
        tenantId,
        botId: targetBotId,
        contactId: contact.id,
        scopeKey: `telegram:${channel.id}`,
        message: messageText,
        channelId: channel.id,
        entryFlow: bot.entryFlow ?? undefined,
        variables: { channel: "telegram", chatId, userId, userName },
      });

      const flowResponses = flowResult?.responses;
      if (flowResponses && flowResponses.length > 0) {
        for (const resp of flowResponses) {
          if (resp.type === "typing") {
            await sendTelegramChatAction(token, chatId, "typing");
            await waitForFlowDurationMs(Math.min(resp.durationMs, 3000));
          } else if (resp.type === "text" && resp.text) {
            const normalized = normalizeTelegramText(resp.text);
            await sendTelegramTextMessage(token, chatId, normalized);
            await prisma.crmMessage.create({
              data: {
                tenantId,
                conversationId: conversation.id,
                direction: "outbound",
                content: normalized,
                source: "flow",
              },
            });
          }
        }
        await Promise.allSettled([
          recordMilestoneEvent(tenantId, "first-channel", { channelType: "telegram", channelId: channel.id }),
          recordMilestoneEvent(tenantId, "first-automated-reply", { channelType: "telegram", source: "flow" }),
        ]);
        return;
      }
    } catch (error) {
      logger.error({ error }, "[Telegram Worker] Flow error");
    }

    // AI Fallback
    try {
      const { aiFallback } = await import("@/lib/ai-fallback");
      const lastMessages = await prisma.crmMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { content: true, source: true },
      });
      const aiMessages: ModelMessage[] = lastMessages.reverse().map((msg: any) => ({
        role: msg.source === "human" ? "user" : "assistant",
        content: msg.content,
      }));

      const subscription = await prisma.subscription.findUnique({
        where: { tenantId },
        select: { plan: { select: { name: true } } },
      });

      const aiStream = await aiFallback({
        botId: targetBotId,
        conversationId: conversation.id,
        messages: aiMessages,
        planName: subscription?.plan?.name || "free",
      });

      const aiTextResult = aiStream && "text" in aiStream ? await aiStream.text : String(aiStream ?? "");
      if (aiTextResult.trim()) {
        replyText = aiTextResult.trim();
        replySource = "ai";
      }
    } catch (aiError) {
      logger.error({ error: aiError }, "[Telegram Worker] AI error");
    }
  }

  if (!replyText && isStartCommand) {
    replyText = "Welcome to ReplyBase. Send a message and I will help you right away.";
    replySource = "system";
  }

  if (!replyText) {
    replyText = "All of our agents are currently busy or offline. Please leave your email address, and we'll get back to you as soon as possible.";
    replySource = "system";
  }

  const finalReply = normalizeTelegramText(replyText);
  await sendTelegramTextMessage(token, chatId, finalReply);
  await prisma.crmMessage.create({
    data: {
      tenantId,
      conversationId: conversation.id,
      direction: "outbound",
      content: finalReply,
      source: replySource,
    },
  });

  await Promise.allSettled([
    recordMilestoneEvent(tenantId, "first-channel", { channelType: "telegram", channelId: channel.id }),
    recordMilestoneEvent(tenantId, "first-automated-reply", { channelType: "telegram", source: replySource }),
  ]);
}
