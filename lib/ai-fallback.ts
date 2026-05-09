import { prisma } from "@/lib/prisma";
import { streamText, Output, ModelMessage, generateObject } from "ai";
import { z } from "zod";
import { getAiModel, AiProvider } from "@/lib/ai-service";
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
    return "I'd be happy to show you our plans! We offer Starter (£29/mo), Pro (£99/mo), and Business tiers. Based on your volume, I can recommend the best one. Would you like to see a personalized ROI breakdown?";
  }
  if (lowerMsg.includes("human") || lowerMsg.includes("agent") || lowerMsg.includes("specialist")) {
    return "I understand. I'm loopng in one of our automation specialists to assist you further. In the meantime, feel free to ask me anything about our features!";
  }

  // Fetch bot and tenant context
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: {
      tenantId: true,
      context: true,
      name: true,
      tenant: {
        select: {
          aiProvider: true,
          aiApiKey: true,
          aiModel: true,
        },
      },
    },
  });

  if (!bot) throw new Error("Bot not found");

  const provider = (bot?.tenant?.aiProvider as AiProvider) || "default";
  const fastModel = getAiModel({ provider, planName, task: "chat", isFallback: true }); // Haiku / GPT-3.5

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
  });

  // --- MODULE 3.1: CONFIDENCE-BASED EXTRACTION ---
  if (intentData.confidence > 0.85) {
    // Silent auto-save to CRM
    if (intentData.extractedEntities.businessType || intentData.extractedEntities.monthlyVolume) {
      await prisma.contact.updateMany({
        where: { conversations: { some: { id: conversationId } } },
        data: {
          ...(intentData.extractedEntities.businessType ? { businessType: intentData.extractedEntities.businessType } : {}),
        },
      });
    }
  }

  // --- MODULE 2, LAYER 3: GENERATIVE FALLBACK AI (Cost: High) ---
  const systemPrompt = buildFallbackSystemPrompt(bot.context as any, bot.name || undefined);
  
  // MODULE 3.2: INTENT-WEIGHTED SALES PRESSURE
  let salesNudge = "";
  if (intentData.intent === "pricing" || intentData.intent === "demo") {
    salesNudge = "\n\n(Nudge: Gently encourage them to start a 14-day free trial or book a demo.)";
  }

  let promptMessages: ModelMessage[] = [
    { role: "system", content: systemPrompt + salesNudge },
    ...messages,
  ] as ModelMessage[];

  const plan = planName.toLowerCase();
  if (plan.includes("pro") || plan.includes("business")) {
    const lastMessages = await prisma.crmMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { content: true, source: true },
    });
    const historyBlock = `Recent Conversation:\n${lastMessages.reverse().map(m => `[${m.source}] ${m.content}`).join("\n")}`;
    promptMessages[0].content += `\n\n${historyBlock}`;
  }

  const model = getAiModel({
    provider,
    apiKey: bot?.tenant?.aiApiKey || undefined,
    model: bot?.tenant?.aiModel || undefined,
    planName,
    task: "chat",
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const aiStream = await streamText({
      model,
      messages: promptMessages,
      output: Output.text(),
      abortSignal: controller.signal,
      onFinish: async () => {
        await incrementTenantUsage(bot.tenantId, "message", 1, botId);
      },
    });
    return aiStream;
  } finally {
    clearTimeout(timeoutId);
  }
}
