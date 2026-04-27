import { prisma } from "@/lib/prisma";
import { streamText, Output } from "ai";
import { getAiModel, AiProvider, MAX_TOKENS_BY_PLAN } from "@/lib/ai-service";

/**
 * Centralized fallback message — used across all channels when AI is unavailable.
 * Professional, reassuring, and brand-consistent.
 */
export const AI_FALLBACK_MESSAGE =
  "Our AI assistant is temporarily unavailable. Please try again shortly—your request is important to us.";

/** Absolute timeout for any AI call (ms). */
const AI_CALL_TIMEOUT_MS = 15_000;

export interface AiFallbackOptions {
  botId: string;
  conversationId: string;
  messages: any[];
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
  let promptMessages = messages;
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
    promptMessages = [{ role: "system", content: contextBlock }, ...messages];
  }
  // For free/starter, just use messages

  const provider = (bot?.tenant?.aiProvider as AiProvider) || "default";
  const model = getAiModel({
    provider,
    apiKey: bot?.tenant?.aiApiKey || undefined,
    model: bot?.tenant?.aiModel || undefined,
    planName,
  });

  // Resolve max tokens from plan
  const maxTokens = MAX_TOKENS_BY_PLAN[plan] || MAX_TOKENS_BY_PLAN.free;

  // Use AbortController for clean timeout handling of AI streams
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), AI_CALL_TIMEOUT_MS);

  try {
    const aiStream = await streamText({
      model,
      messages: promptMessages,
      output: Output.text(),
      maxTokens,
      abortSignal: abortController.signal,
    });

    clearTimeout(timeoutId);
    return aiStream;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI call timed out");
    }
    throw error;
  }
}
