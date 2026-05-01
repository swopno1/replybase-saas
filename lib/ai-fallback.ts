import { prisma } from "@/lib/prisma";
import { streamText, Output, ModelMessage } from "ai";
import { getAiModel, AiProvider } from "@/lib/ai-service";

export interface AiFallbackOptions {
  botId: string;
  conversationId: string;
  messages: ModelMessage[];
  planName: string;
  charLimit?: number;
}

/**
 * Fetches bot context and last N messages, builds prompt, and streams AI fallback response.
 * - For pro/business: injects bot context and last N messages (char limit)
 * - For free/starter: uses simple prompt
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

  // Fetch last N messages (limit by char count)
  const lastMessages = await prisma.crmMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 10, // fetch up to 10, trim by char below
    select: { content: true, source: true, createdAt: true },
  });
  // Reverse to chronological order
  const ordered = lastMessages.reverse();
  const contextMessages: string[] = [];
  let totalChars = 0;
  for (const msg of ordered) {
    const line = `[${msg.source}] ${msg.content}`;
    if (totalChars + line.length > charLimit) break;
    contextMessages.push(line);
    totalChars += line.length;
  }

  // Build prompt
  let promptMessages: ModelMessage[] = messages;
  const plan = planName.toLowerCase();
  if (plan.includes("pro") || plan.includes("business")) {
    // Inject bot context and last messages
    const contextBlock = [
      bot?.context ? `Bot Context: ${JSON.stringify(bot.context)}` : null,
      contextMessages.length
        ? `Recent Conversation:\n${contextMessages.join("\n")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");
    promptMessages = [
      { role: "system", content: contextBlock },
      ...messages,
    ] as ModelMessage[];
  }
  // For free/starter, just use messages

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
      });
      return aiStream;
    } catch (primaryError: any) {
      // Check for rate limit errors (429 or RESOURCE_EXHAUSTED)
      const isRateLimit = 
        String(primaryError).includes("429") || 
        String(primaryError).includes("RESOURCE_EXHAUSTED");

      if (isRateLimit) {
        console.warn("[AI Fallback] Rate limit hit on primary model. Failing over to Gemma...");
        
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
