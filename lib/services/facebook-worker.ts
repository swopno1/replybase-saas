import { prisma } from "@/lib/prisma";
import { ModelMessage } from "ai";
import { executeBotEntryFlowFirst } from "@/lib/bot-entry-flow-engine";
import { recordMilestoneEvent } from "@/lib/milestone-events";
import { waitForFlowDurationMs } from "@/lib/flow-runtime-utils";
import {
  sendFacebookSenderAction,
  sendTextMessage,
} from "@/lib/facebook-sender";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";
import { checkTenantUsageLimits, incrementTenantUsage } from "@/lib/subscription";
import { stitchContactIdentities } from "@/lib/contact-stitching";
import { leadService } from "./lead-service";
import logger from "@/lib/logger";

export async function processFacebookJob(payload: any) {
  const { senderPsid, pageId, messageText, botId } = payload;

  const facebookPage = await prisma.facebookPage.findUnique({
    where: { facebookId: pageId },
  });

  if (!facebookPage || !facebookPage.tenantId) return;

  const targetBotId = botId || facebookPage.botId;
  if (!targetBotId) return;

  const { tenantId, accessToken } = facebookPage;

  // 1. Check Monthly Conversation Limit (across all channels)
  const convLimit = await checkTenantUsageLimits(tenantId, "conversation");
  if (!convLimit.allowed) {
    logger.warn({ tenantId }, "[Facebook Worker] Monthly conversation limit reached");
    return;
  }

  let userName: string | undefined;
  try {
    const profileUrl = getFacebookGraphUrl(senderPsid, accessToken, {
      fields: "first_name,last_name",
    });
    const profileResponse = await fetch(profileUrl);
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      const fullName = `${profileData.first_name || ""} ${profileData.last_name || ""}`.trim();
      if (fullName) userName = fullName;
    }
  } catch {}

  let contact = await prisma.contact.findFirst({
    where: {
      tenantId,
      identities: { some: { type: "facebook_psid", value: senderPsid } },
    },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        tenantId,
        name: userName || senderPsid,
        identities: { create: { type: "facebook_psid", value: senderPsid } },
      },
    });
  }

  // Auto-tag and promote to lead if identified
  await leadService.syncContactIdentifiedStatus(tenantId, contact.id);

  // --- MODULE 1: IDENTITY STITCHING HANDSHAKE ---
  let stitchedVars: Record<string, any> = {};
  if (messageText.startsWith("SYNC_")) {
    const sessionHash = messageText.replace("SYNC_", "").trim();
    if (sessionHash) {
      const stitchResult = await stitchContactIdentities({
        tenantId,
        identifiedContactId: contact.id,
        sessionHash,
      });
      if (stitchResult) {
        stitchedVars = stitchResult.previousVariables;
        // Optionally reply with a confirmation on social channel
        await sendTextMessage(accessToken, senderPsid, "Session synced! 👋 Picking up exactly where we left off.");
      }
    }
  }

  let conversation = await prisma.crmConversation.findFirst({
    where: { contactId: contact.id, botId: targetBotId, channel: "facebook" },
  });

  if (!conversation) {
    conversation = await prisma.crmConversation.create({
      data: {
        tenantId,
        contactId: contact.id,
        channel: "facebook",
        botId: targetBotId,
        facebookPageId: facebookPage.id,
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

  if (conversation.botPaused) return;

  // Bot Status check
  const bot = await prisma.bot.findUnique({
    where: { id: targetBotId },
    select: { enabled: true }
  });
  if (!bot || !bot.enabled) return;

  try {
    const flowAssignment = await prisma.flowAssignment.findFirst({
      where: { pageId: facebookPage.id, isActive: true },
      select: { flowId: true },
    });

    const flowResult = await executeBotEntryFlowFirst({
      tenantId,
      botId: targetBotId,
      contactId: contact.id,
      scopeKey: `facebook:${facebookPage.id}`,
      message: messageText,
      entryFlow: flowAssignment?.flowId ?? null,
      variables: { 
        channel: "facebook", 
        psid: senderPsid,
        ...stitchedVars 
      },
    });

    const flowResponses = flowResult?.responses;
    if (flowResponses && flowResponses.length > 0) {
      // 2. Check AI Response / Automation Limit
      const msgLimit = await checkTenantUsageLimits(tenantId, "message");
      if (!msgLimit.allowed) {
        logger.warn({ tenantId }, "[Facebook Worker] Monthly message limit reached");
        return;
      }

      for (const resp of flowResponses) {
        if (resp.type === "typing") {
          await sendFacebookSenderAction(accessToken, senderPsid, "typing_on");
          await waitForFlowDurationMs(Math.min(resp.durationMs, 3000));
          await sendFacebookSenderAction(accessToken, senderPsid, "typing_off");
        } else if (resp.type === "text" && resp.text) {
          await sendTextMessage(accessToken, senderPsid, resp.text, (resp as any).quickReplies);
          await prisma.crmMessage.create({
            data: {
              tenantId,
              conversationId: conversation.id,
              direction: "outbound",
              content: resp.text,
              source: "flow",
            },
          });
          
          // Increment Usage
          await incrementTenantUsage(tenantId, "message", 1, targetBotId, facebookPage.id);
        }
      }
      await Promise.allSettled([
        recordMilestoneEvent(tenantId, "first-channel", { channelType: "facebook", pageId: facebookPage.id }),
        recordMilestoneEvent(tenantId, "first-automated-reply", { channelType: "facebook", source: "flow" }),
      ]);
      return;
    }
  } catch (error) {
    logger.error({ error }, "[Facebook Worker] Flow error");
  }

  // AI fallback
  try {
    // 3. Check AI Response / Automation Limit (again for AI)
    const msgLimit = await checkTenantUsageLimits(tenantId, "message");
    if (!msgLimit.allowed) return;

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      select: { plan: { select: { name: true } } },
    });
    const plan = subscription?.plan?.name || "free";

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

    const { aiFallback } = await import("@/lib/ai-fallback");
    const aiStream = await aiFallback({
      botId: targetBotId,
      conversationId: conversation.id,
      messages: aiMessages,
      planName: plan,
    });

    let aiText = "";
    if (typeof aiStream === "string") {
      aiText = aiStream;
    } else if (aiStream && typeof aiStream === "object" && "text" in aiStream) {
      aiText = await (aiStream as any).text;
    }

    if (aiText.trim()) {
      await sendTextMessage(accessToken, senderPsid, aiText.trim());
      await prisma.crmMessage.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          direction: "outbound",
          content: aiText.trim(),
          source: "ai",
        },
      });

      // Increment Usage
      await incrementTenantUsage(tenantId, "message", 1, targetBotId, facebookPage.id);

      await Promise.allSettled([
        recordMilestoneEvent(tenantId, "first-channel", { channelType: "facebook", pageId: facebookPage.id }),
        recordMilestoneEvent(tenantId, "first-automated-reply", { channelType: "facebook", source: "ai" }),
      ]);
      return;
    }
  } catch (aiError) {
    logger.error({ error: aiError }, "[Facebook Worker] AI error");
  }
}
