import { prisma } from "@/lib/prisma";
import { getTenantPrisma } from "@/lib/prisma-tenant";

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
import { checkTenantUsageLimits, incrementTenantUsage } from "@/lib/subscription";
import { stitchContactIdentities } from "@/lib/contact-stitching";
import logger from "@/lib/logger";
import { leadService } from "./lead-service";

export async function processWhatsAppJob(payload: any) {
  const { channel, waId, profileName, rawPhone, inboundText, messageId, timestamp, botId } = payload;

  // Use botId from payload for multi-bot isolation
  const targetBotId = botId || channel.botId;
  const tenantId = channel.bot.tenantId;

  // Tenant-scoped Prisma client — automatically injects tenantId on all queries
  const db = getTenantPrisma(tenantId);


  // --- IDENTITY STITCHING HANDSHAKE ---
  if (inboundText?.startsWith("SYNC_")) {
    const sessionHash = inboundText.replace("SYNC_", "").trim();
    if (sessionHash) {
      // Find or create the social contact first so we have something to stitch into
      const normalizedWaId = normalizeWhatsAppAddress(waId);
      const normalizedPhone = rawPhone ? normalizeWhatsAppE164(rawPhone) : null;
      
      let contact = await db.contact.findFirst({
        where: {
          identities: { some: { type: "whatsapp_wa_id", value: normalizedWaId } },
        },
      });

      if (!contact) {
        contact = await db.contact.create({
            data: {
              tenantId,
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

      const stitchResult = await stitchContactIdentities({
        tenantId,
        identifiedContactId: contact.id,
        sessionHash,
      });

      if (stitchResult) {
        if (!channel.accessToken) return;
        const envelope = decryptWhatsAppCredentialEnvelope(channel.accessToken);
        await sendWhatsAppText({
          provider: envelope.provider,
          credentials: envelope.credentials as WhatsAppProviderCredentials,
          to: normalizedWaId,
          text: "Session synced! 🚀 I've picked up exactly where we left off on the website.",
        });
        return; // Stop processing this message as it was just a handshake
      }
    }
  }

  // 1. Check Monthly Conversation Limit
  const convLimit = await checkTenantUsageLimits(tenantId, "conversation");
  if (!convLimit.allowed) {
    logger.warn({ tenantId }, "[WhatsApp Worker] Monthly conversation limit reached");
    return;
  }

  const normalizedWaId = normalizeWhatsAppAddress(waId);
  const normalizedPhone = rawPhone ? normalizeWhatsAppE164(rawPhone) : null;

  let contact = await db.contact.findFirst({
    where: {
      identities: { some: { type: "whatsapp_wa_id", value: normalizedWaId } },
    },
  });

  if (!contact) {
    contact = await db.contact.create({
      data: {
        tenantId: tenantId,
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

  // Auto-tag and promote to lead if identified
  await leadService.syncContactIdentifiedStatus(tenantId, contact.id);

  let conversation = await db.crmConversation.findFirst({
    where: { contactId: contact.id, botId: targetBotId, channel: "whatsapp" },
  });

  if (!conversation) {
    conversation = await db.crmConversation.create({
      data: {
        tenantId: tenantId,
        contactId: contact.id,
        botId: targetBotId,
        channel: "whatsapp",
      },
    });
  }

  await db.crmMessage.create({
    data: {
      tenantId: tenantId,
      conversationId: conversation.id,
      direction: "inbound",
      content: inboundText,
      source: "human",
    },
  });

  // --- LEAD EXTRACTION ---
  await leadService.extractAndSyncLeadDataFromMessage(tenantId, contact.id, inboundText);

  const currentMetadata =
    conversation.metadata &&
    typeof conversation.metadata === "object" &&
    !Array.isArray(conversation.metadata)
      ? (conversation.metadata as Prisma.JsonObject)
      : {};

  await db.crmConversation.update({
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

  if (!channel.accessToken) return;
  const envelope = decryptWhatsAppCredentialEnvelope(channel.accessToken);

  try {
    // Check for bot status (enabled/disabled)
    const bot = await prisma.bot.findUnique({
      where: { id: targetBotId },
      select: { enabled: true, entryFlow: true }
    });

    if (!bot || !bot.enabled) return;

    const flowResult = await executeBotEntryFlowFirst({
      tenantId: tenantId,
      botId: targetBotId,
      contactId: contact.id,
      scopeKey: `whatsapp:${channel.id}`,
      message: inboundText,
      channelId: channel.id,
      entryFlow: bot.entryFlow ?? undefined,
      variables: { channel: "whatsapp", waId: normalizedWaId },
    });

    const flowResponses = flowResult?.responses;
    if (flowResponses && flowResponses.length > 0) {
      // 2. Check Automation Limit
      const msgLimit = await checkTenantUsageLimits(tenantId, "message");
      if (!msgLimit.allowed) return;

      for (const resp of flowResponses) {
        if (resp.type === "typing") await waitForFlowDurationMs(Math.min(resp.durationMs, 2000));
        else if (resp.type === "text" && resp.text) {
          const sendResult = await sendWhatsAppText({
            provider: envelope.provider,
            credentials: envelope.credentials as WhatsAppProviderCredentials,
            to: normalizedWaId,
            text: resp.text,
            buttons: resp.quickReplies?.map((qr: any) => ({
              title: qr.title,
              payload: qr.payload,
            })),
          });
          if (sendResult.success) {
            await db.crmMessage.create({
              data: {
                tenantId: tenantId,
                conversationId: conversation.id,
                direction: "outbound",
                content: resp.text,
                source: "flow",
              },
            });

            // Increment Usage
            await incrementTenantUsage(tenantId, "message", 1, targetBotId, channel.id);
          } else {
            logger.error({ botId, waId, error: sendResult.error }, "[Worker] Failed to send Flow response");
            throw new Error(`WhatsApp send failed (Flow): ${sendResult.error}`);
          }
        }
      }

      await Promise.allSettled([
        recordMilestoneEvent(tenantId, "first-channel", { channelType: "whatsapp", channelId: channel.id }),
        recordMilestoneEvent(tenantId, "first-automated-reply", { channelType: "whatsapp", source: "flow" }),
      ]);
      return;
    }
  } catch (err) {
    logger.error({ error: err }, "[WhatsApp Worker] Flow error");
  }

  // AI Fallback
  try {
    // 3. Check AI Response Limit
    const msgLimit = await checkTenantUsageLimits(tenantId, "message");
    if (!msgLimit.allowed) return;

    const { aiFallback } = await import("@/lib/ai-fallback");
    const lastMessages = await db.crmMessage.findMany({
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
      where: { tenantId: tenantId },
      select: { plan: { select: { name: true } } },
    });

    const aiStream = await aiFallback({
      botId: targetBotId,
      conversationId: conversation.id,
      messages: aiMessages,
      planName: subscription?.plan?.name || "free",
    });
    let replyText = "";
    if (typeof aiStream === "string") {
      replyText = aiStream;
    } else if (aiStream && typeof aiStream === "object" && "text" in aiStream) {
      replyText = await (aiStream as any).text;
    }

    const sendResult = await sendWhatsAppText({
      provider: envelope.provider,
      credentials: envelope.credentials as WhatsAppProviderCredentials,
      to: normalizedWaId,
      text: replyText,
    });

      if (sendResult.success) {
        await db.crmMessage.create({
          data: {
            tenantId: tenantId,
            conversationId: conversation.id,
            direction: "outbound",
            content: replyText,
            source: "ai",
          },
        });

        // Increment Usage
        await incrementTenantUsage(tenantId, "message", 1, targetBotId, channel.id);

        await Promise.allSettled([
          recordMilestoneEvent(tenantId, "first-channel", { channelType: "whatsapp", channelId: channel.id }),
          recordMilestoneEvent(tenantId, "first-automated-reply", { channelType: "whatsapp", source: "ai" }),
        ]);
      } else {
        logger.error({ botId, waId, error: sendResult.error }, "[Worker] Failed to send AI response");
        throw new Error(`WhatsApp send failed (AI): ${sendResult.error}`);
      }
  } catch (aiError) {
    logger.error({ error: aiError }, "[WhatsApp Worker] AI error");
  }
}
