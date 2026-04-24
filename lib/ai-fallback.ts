import { prisma } from "@/lib/prisma";
import { streamText, Output } from "ai";
import { google } from "@ai-sdk/google";

export interface AiFallbackOptions {
  botId: string;
  conversationId: string;
  messages: any[]; // TODO: Need to define a proper type for messages
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
  // Fetch bot context
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: { context: true, name: true },
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

  // Use cost-effective model for all, can upgrade for pro later
  const aiStream = await streamText({
    model: google("gemini-1.5-flash"),
    messages: promptMessages,
    output: Output.text(),
  });
  return aiStream;
}
