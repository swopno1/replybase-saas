import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getTenantModel } from "@/lib/ai-service";
import { prisma } from "@/lib/prisma";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { getTenantLimits } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export const POST: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(
  async ({ tenantId }, request, context) => {
    const { conversationId } = await context.params;

    try {
      // 1. Fetch conversation context (scoped to tenant to prevent IDOR)
      const conversation = await prisma.crmConversation.findFirst({
        where: {
          id: conversationId as string,
          contact: {
            tenantId,
          },
        },
        include: {
          contact: {
            include: {
              conversations: {
                include: {
                  messages: {
                    orderBy: { createdAt: "desc" },
                    take: 12,
                  },
                },
              },
            },
          },
        },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }

      // 2. Setup AI Model
      const limits = await getTenantLimits(tenantId);
      const planName = (limits.displayName || limits.name || "free").toLowerCase();

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });

      const model = await getTenantModel(tenantId, {
        planName,
        task: "chat",
      });

      // 3. Prepare prompt with cross-channel history
      const contactName = conversation.contact.name || "the customer";
      
      // Flatten all messages from all conversations
      const allMessages = conversation.contact.conversations.flatMap(c => 
        c.messages.map(m => ({
          ...m,
          channel: c.channel
        }))
      ).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      // Only take the last 15 messages for the prompt
      const recentMessages = allMessages.slice(-15);

      const messageHistory = recentMessages
        .map((m) => `[${m.channel.toUpperCase()}] ${m.direction === "inbound" ? contactName : "You"}: ${m.content}`)
        .join("\n");

      const systemPrompt = `You are an expert customer support agent for ${tenant?.name || "our company"}.
Your goal is to suggest a helpful, professional, and concise reply to the customer based on the conversation history.
Keep the tone friendly but professional.
Do not include any placeholders like [Name].
Respond ONLY with the suggested reply text.`;

      const userPrompt = `Conversation history:
${messageHistory}

Suggest the next reply:`;

      // 4. Generate suggestion with 15s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        let textResult = "";
        try {
          const { text } = await generateText({
            model,
            system: systemPrompt,
            prompt: userPrompt,
            abortSignal: controller.signal,
          });
          textResult = text;
        } catch (primaryError: any) {
          const isRateLimit = 
            String(primaryError).includes("429") || 
            String(primaryError).includes("RESOURCE_EXHAUSTED");

          if (isRateLimit) {
            console.warn("[Suggest Reply] Rate limit hit. Failing over to fallback...");
            const fallbackModel = await getTenantModel(tenantId, {
              planName,
              task: "chat",
              isFallback: true,
            });

            const { text } = await generateText({
              model: fallbackModel,
              system: systemPrompt,
              prompt: userPrompt,
              abortSignal: controller.signal,
            });
            textResult = text;
          } else {
            throw primaryError;
          }
        }

        return NextResponse.json({ suggestion: textResult.trim() });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: any) {
      console.error("[Suggest Reply API] Error:", error);
      return NextResponse.json(
        { error: error?.message || "Failed to generate suggestion" },
        { status: 500 },
      );
    }
  },
);
