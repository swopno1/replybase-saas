import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getAiModel, AiProvider } from "@/lib/ai-service";
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
          messages: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          contact: true,
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
        select: { name: true, aiProvider: true, aiApiKey: true, aiModel: true },
      });

      const provider = (tenant?.aiProvider as AiProvider) || "default";
      const model = getAiModel({
        provider,
        apiKey: tenant?.aiApiKey || undefined,
        model: tenant?.aiModel || undefined,
        planName,
      });

      // 3. Prepare prompt
      const contactName = conversation.contact.name || "the customer";
      const messageHistory = [...conversation.messages]
        .reverse()
        .map((m) => `${m.direction === "inbound" ? contactName : "You"}: ${m.content}`)
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
        const { text } = await generateText({
          model,
          system: systemPrompt,
          prompt: userPrompt,
          abortSignal: controller.signal,
        });

        return NextResponse.json({ suggestion: text.trim() });
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
