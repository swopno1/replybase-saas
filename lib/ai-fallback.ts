import logger from "./logger";
import { prisma } from "@/lib/prisma";
import { streamText, Output, ModelMessage } from "ai";
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

  if (!bot) {
    throw new Error("Bot not found");
  }

  const tenantId = bot.tenantId;

  // Build grounded system prompt from bot context (ALL plans)
  const botContext = bot.context as Record<string, unknown> | null;
  const systemPrompt = buildFallbackSystemPrompt(botContext, bot.name || undefined);

  // Build prompt messages — always include system prompt
  let promptMessages: ModelMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ] as ModelMessage[];

  // For Pro/Business plans, also include recent conversation history
  const plan = planName.toLowerCase();
  if (plan.includes("pro") || plan.includes("business")) {
    const lastMessages = await prisma.crmMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { content: true, source: true, createdAt: true },
    });

    const ordered = lastMessages.reverse();
    const contextMessages: string[] = [];
    let totalChars = 0;
    for (const msg of ordered) {
      const line = `[${msg.source}] ${msg.content}`;
      if (totalChars + line.length > charLimit) break;
      contextMessages.push(line);
      totalChars += line.length;
    }

    if (contextMessages.length > 0) {
      const historyBlock = `Recent Conversation:\n${contextMessages.join("\n")}`;
      promptMessages = [
        { role: "system", content: `${systemPrompt}\n\n${historyBlock}` },
        ...messages,
      ] as ModelMessage[];
    }
  }

  const provider = (bot?.tenant?.aiProvider as AiProvider) || "default";
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
    try {
      const aiStream = await streamText({
        model,
        messages: promptMessages,
        output: Output.text(),
        abortSignal: controller.signal,
        onFinish: async () => {
          await incrementTenantUsage(tenantId, "message", 1, botId);
        },
      });
      return aiStream;
    } catch (primaryError: unknown) {
      // Check for rate limit errors (429 or RESOURCE_EXHAUSTED)
      const isRateLimit =
        String(primaryError).includes("429") ||
        String(primaryError).includes("RESOURCE_EXHAUSTED");

      if (isRateLimit) {
        logger.warn(
          "[AI Fallback] Rate limit hit on primary model. Failing over to Gemma...",
        );

        const fallbackModel = getAiModel({
          provider,
          apiKey: bot?.tenant?.aiApiKey || undefined,
          model: bot?.tenant?.aiModel || undefined,
          planName,
          task: "chat",
          isFallback: true,
        });

        const fallbackStream = await streamText({
          model: fallbackModel,
          messages: promptMessages,
          output: Output.text(),
          abortSignal: controller.signal,
          onFinish: async () => {
            await incrementTenantUsage(tenantId, "message", 1, botId);
          },
        });
        return fallbackStream;
      }

      // Re-throw if not a rate limit error
      throw primaryError;
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
