import { prisma } from "@/lib/prisma";
import { streamText, Output, ModelMessage, generateObject } from "ai";
import { z } from "zod";
import { getTenantModel } from "@/lib/ai-service";
import { incrementTenantUsage } from "./subscription";
import { buildFallbackSystemPrompt } from "@/lib/onboarding-ai";

export interface AiFallbackOptions {
  botId: string;
  conversationId: string;
  messages: ModelMessage[];
  planName: string;
  charLimit?: number;
}

/**
 * Fetches bot context and last N messages, builds a grounded system prompt,
 * and streams an AI fallback response.
 *
 * ALL plan tiers now receive a structured system prompt built from bot context.
 * - Pro/Business: includes recent conversation history for richer context
 * - Free/Starter: system prompt only (no conversation history)
 */
export async function aiFallback({
  botId,
  conversationId,
  messages,
  planName,
  charLimit = 1000,
}: AiFallbackOptions) {
  const lastUserMessage = messages[messages.length - 1]?.content as string;

  // --- MODULE 2, LAYER 1: DETERMINISTIC / REGEX (Cost: $0.00) ---
  const lowerMsg = lastUserMessage?.toLowerCase() || "";
  if (lowerMsg.includes("pricing") || lowerMsg.includes("how much") || lowerMsg.includes("cost")) {
    return "I'd be happy to show you our plans! We offer Starter (£29/mo), Pro (£89/mo), and Business tiers. Based on your volume, I can recommend the best one. Would you like to see a personalized ROI breakdown?";
  }
  if (lowerMsg.includes("human") || lowerMsg.includes("agent") || lowerMsg.includes("specialist")) {
    return "I understand. I'm loopng in one of our automation specialists to assist you further. In the meantime, feel free to ask me anything about our features!";
  }

  // Fetch bot context
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: {
      tenantId: true,
      context: true,
      name: true,
    },
  });

  if (!bot) throw new Error("Bot not found");

  // MODULE 2, LAYER 2: FAST INTENT & EXTRACTION (Cost: Low)
  // Uses the tenant's configured provider but force fallback (lite) model for speed
  const fastModel = await getTenantModel(bot.tenantId, { planName, task: "chat", isFallback: true });

  // --- MODULE 2, LAYER 2: FAST INTENT & EXTRACTION (Cost: Low) ---
  const { object: intentData } = await generateObject({
    model: fastModel,
    schema: z.object({
      intent: z.enum(["pricing", "feature_request", "demo", "support", "generic"]),
      confidence: z.number().min(0).max(1),
      extractedEntities: z.object({
        businessType: z.string().optional(),
        monthlyVolume: z.string().optional(),
      }),
    }),
    prompt: `Analyze this user message for ReplyBase SaaS: "${lastUserMessage}"`,
    // @ts-ignore
    maxTokens: 150, // Small limit for structured extraction
  });

  // --- MODULE 3.1: CONFIDENCE-BASED EXTRACTION ---
  if (intentData.confidence > 0.85) {
    // Silent auto-save to CRM (Lead model has businessType, Contact does not)
    if (intentData.extractedEntities.businessType) {
      await prisma.lead.updateMany({
        where: {
          contact: { conversations: { some: { id: conversationId } } },
        },
        data: {
          businessType: intentData.extractedEntities.businessType,
        },
      });
    }
  }

  // --- MODULE 2, LAYER 3: GENERATIVE FALLBACK AI (Cost: High) ---
  const systemPrompt = buildFallbackSystemPrompt(
    bot.context as any,
    bot.name || undefined,
  );

  // MODULE 3.2: INTENT-WEIGHTED SALES PRESSURE
  let salesNudge = "";
  if (intentData.intent === "pricing" || intentData.intent === "demo") {
    salesNudge =
      "\n\n(Nudge: Gently encourage them to start a 14-day free trial or book a demo.)";
  }

  // Cross-channel context: ALL plans get history so context is never lost.
  // Pro/Business gets a deeper window (12 msgs), Free/Starter gets 6.
  const plan = planName.toLowerCase();
  const historyDepth =
    plan.includes("pro") || plan.includes("business") ? 12 : 6;

  const currentConv = await prisma.crmConversation.findUnique({
    where: { id: conversationId },
    select: { contactId: true },
  });

  let historyBlock = "";
  if (currentConv?.contactId) {
    const allMessages = await prisma.crmMessage.findMany({
      where: {
        conversation: {
          contactId: currentConv.contactId,
        },
      },
      orderBy: { createdAt: "desc" },
      take: historyDepth,
      include: {
        conversation: {
          select: { channel: true },
        },
      },
    });

    if (allMessages.length > 0) {
      historyBlock = `\n\nRecent Cross-Channel History:\n${allMessages
        .reverse()
        .map(
          (m) =>
            `[${m.conversation.channel.toUpperCase()}] [${m.source}] ${m.content}`,
        )
        .join("\n")}`;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const finalSystemPrompt = systemPrompt + salesNudge + historyBlock;

  try {
    // LAYER 3: Primary Generative Attempt
    const primaryModel = await getTenantModel(bot.tenantId, {
      planName,
      task: "chat",
    });

    const aiStream = await streamText({
      model: primaryModel,
      system: finalSystemPrompt,
      messages: messages,
      output: Output.text(),
      abortSignal: controller.signal,
      onFinish: async () => {
        await incrementTenantUsage(bot.tenantId, "message", 1, botId);
      },
      // @ts-ignore
      maxTokens: 800, // Balanced limit for helpful but concise chat
    });
    return aiStream;
  } catch (primaryError) {
    console.error(
      "[AI Fallback] Primary model failed, attempting secondary fallback:",
      primaryError,
    );

    try {
      // LAYER 4: Secondary Generative Attempt (Emergency Fallback)
      const secondaryModel = await getTenantModel(bot.tenantId, {
        planName,
        task: "chat",
        isFallback: true,
      });

      const secondaryStream = await streamText({
        model: secondaryModel,
        system: finalSystemPrompt,
        messages: messages,
        output: Output.text(),
        abortSignal: controller.signal,
        onFinish: async () => {
          await incrementTenantUsage(bot.tenantId, "message", 1, botId);
        },
        // @ts-ignore
        maxTokens: 800,
      });
      return secondaryStream;
    } catch (secondaryError) {
      console.error("[AI Fallback] Secondary model also failed:", secondaryError);
      return "I'm having a bit of trouble processing that right now. How else can I help you?";
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
