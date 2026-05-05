import { prisma } from "@/lib/prisma";
import { ModelMessage } from "ai";
import { executeBotEntryFlowFirst } from "@/lib/bot-entry-flow-engine";
import { recordMilestoneEvent } from "@/lib/milestone-events";
import { waitForFlowDurationMs } from "@/lib/flow-runtime-utils";
import {
  decryptWhatsAppCredentialEnvelope,
  getStringFromJsonConfig,
} from "@/lib/whatsapp-channel-credentials";
import {
  WhatsAppProviderCredentials,
  normalizeWhatsAppAddress,
  normalizeWhatsAppE164,
  sendWhatsAppText,
} from "@/lib/whatsapp-provider";
import { Prisma } from "@prisma/client";
import logger from "@/lib/logger";

export async function processWhatsAppJob(payload: any) {
  const { channel, waId, profileName, rawPhone, inboundText, messageId, timestamp } = payload;

  const normalizedWaId = normalizeWhatsAppAddress(waId);
  const normalizedPhone = rawPhone ? normalizeWhatsAppE164(rawPhone) : null;

  let contact = await prisma.contact.findFirst({
    where: {
      tenantId: channel.bot.tenantId,
      identities: { some: { type: "whatsapp_wa_id", value: normalizedWaId } },
    },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        tenantId: channel.bot.tenantId,
        name: profileName || null,
        phone: normalizedPhone,
        identities: {
          create: [
            { type: "whatsapp_wa_id", value: normalizedWaId },
            ...(normalizedPhone ? [{ type: "whatsapp_phone_e164", value: normalizedPhone }] : []),
          ],
        },
      },
    });
  }

  let conversation = await prisma.crmConversation.findFirst({
    where: { contactId: contact.id, botId: channel.botId, channel: "whatsapp" },
  });

  if (!conversation) {
    conversation = await prisma.crmConversation.create({
      data: {
        tenantId: channel.bot.tenantId,
        contactId: contact.id,
        botId: channel.botId,
        channel: "whatsapp",
      },
    });
  }

  await prisma.crmMessage.create({
    data: {
      tenantId: channel.bot.tenantId,
      conversationId: conversation.id,
      direction: "inbound",
      content: inboundText,
      source: "human",
    },
  });

  const currentMetadata =
    conversation.metadata &&
    typeof conversation.metadata === "object" &&
    !Array.isArray(conversation.metadata)
      ? (conversation.metadata as Prisma.JsonObject)
      : {};

  await prisma.crmConversation.update({
    where: { id: conversation.id },
    data: {
      metadata: {
        ...currentMetadata,
        whatsapp: {
          provider: getStringFromJsonConfig(channel.config, "provider"),
          waId: normalizedWaId,
          lastInboundAt: new Date(timestamp ? Number(timestamp) * 1000 : Date.now()).toISOString(),
          lastInboundMessageId: messageId,
          phoneNumberId: getStringFromJsonConfig(channel.config, "metaPhoneNumberId"),
        },
      } as Prisma.InputJsonValue,
    },
  });

  const currentConfig = (channel.config || {}) as Prisma.JsonObject;
  await prisma.channel.update({
    where: { id: channel.id },
    data: {
      config: {
        ...currentConfig,
        lastWebhookEventAt: new Date().toISOString(),
        lastInboundMessageAt: new Date().toISOString(),
      } as Prisma.JsonObject,
    },
  });

  // Resolving credentials
  if (!channel.accessToken) return;
  const envelope = decryptWhatsAppCredentialEnvelope(channel.accessToken);

  let replySource: "flow" | "ai" = "ai";

  // Try Flow first
  try {
    const flowResult = await executeBotEntryFlowFirst({
      tenantId: channel.bot.tenantId,
      contactId: contact.id,
      scopeKey: `whatsapp:${channel.id}`,
      message: inboundText,
      channelId: channel.id,
      entryFlow: channel.bot.entryFlow ?? undefined,
      variables: { channel: "whatsapp", waId: normalizedWaId },
    });

    const flowResponses = flowResult?.responses;
    if (flowResponses && flowResponses.length > 0) {
      for (const resp of flowResponses) {
        if (resp.type === "typing") await waitForFlowDurationMs(Math.min(resp.durationMs, 2000));
        else if (resp.type === "text" && resp.text) {
          const sendResult = await sendWhatsAppText({
            provider: envelope.provider,
            credentials: envelope.credentials as WhatsAppProviderCredentials,
            to: normalizedWaId,
            text: resp.text,
          });
          if (sendResult.success) {
            await prisma.crmMessage.create({
              data: {
                tenantId: channel.bot.tenantId,
                conversationId: conversation.id,
                direction: "outbound",
                content: resp.text,
                source: "flow",
              },
            });
          }
        }
      }

      await Promise.allSettled([
        recordMilestoneEvent(channel.bot.tenantId, "first-channel", { channelType: "whatsapp", channelId: channel.id }),
        recordMilestoneEvent(channel.bot.tenantId, "first-automated-reply", { channelType: "whatsapp", source: "flow" }),
      ]);
      return;
    }
  } catch (err) {
    logger.error({ error: err }, "[WhatsApp Worker] Flow error");
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
    const aiMessages: ModelMessage[] = lastMessages.reverse().map((msg) => ({
      role: msg.source === "human" ? "user" : "assistant",
      content: msg.content,
    }));

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: channel.bot.tenantId },
      select: { plan: { select: { name: true } } },
    });

    const aiStream = await aiFallback({
      botId: channel.botId,
      conversationId: conversation.id,
      messages: aiMessages,
      planName: subscription?.plan?.name || "free",
    });
    const replyText = aiStream && "text" in aiStream ? await aiStream.text : String(aiStream ?? "");

    const sendResult = await sendWhatsAppText({
      provider: envelope.provider,
      credentials: envelope.credentials as WhatsAppProviderCredentials,
      to: normalizedWaId,
      text: replyText,
    });

    if (sendResult.success) {
      await prisma.crmMessage.create({
        data: {
          tenantId: channel.bot.tenantId,
          conversationId: conversation.id,
          direction: "outbound",
          content: replyText,
          source: "ai",
        },
      });

      await Promise.allSettled([
        recordMilestoneEvent(channel.bot.tenantId, "first-channel", { channelType: "whatsapp", channelId: channel.id }),
        recordMilestoneEvent(channel.bot.tenantId, "first-automated-reply", { channelType: "whatsapp", source: "ai" }),
      ]);
    }
  } catch (aiError) {
    logger.error({ error: aiError }, "[WhatsApp Worker] AI error");
  }
}
