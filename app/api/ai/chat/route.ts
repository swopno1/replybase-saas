import { NextResponse } from "next/server";
import { streamText } from "ai";
import { getAiModel, AiProvider } from "@/lib/ai-service";
import {
  checkLimit,
  incrementUsage,
  incrementTenantUsage,
  getMonthlyConversationCount,
  getTenantLimits,
} from "@/lib/subscription";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { z } from "zod";

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string().min(1),
  })),
});

export const POST = withAuthAndTenant(async ({ id, tenantId }, request, context, db) => {
  try {
    // Quota checks
    const aiMessageQuota = await checkLimit(id, "message");
    if (!aiMessageQuota.allowed) {
      return NextResponse.json(
        {
          error: "AI Responses quota exceeded",
          limit: aiMessageQuota.limit,
          remaining: aiMessageQuota.remaining,
          retryAfter: aiMessageQuota.retryAfter,
        },
        { status: 429 },
      );
    }

    const limits = await getTenantLimits(tenantId);
    const automationCount = await getMonthlyConversationCount(tenantId);
    if (automationCount >= limits.flowExecutionCap) {
      return NextResponse.json(
        {
          error: "Automations quota exceeded",
          limit: limits.flowExecutionCap,
          remaining: 0,
        },
        { status: 429 },
      );
    }

    // Prepare AI context based on plan and tenant settings
    const planName = (limits.displayName || limits.name || "free").toLowerCase();
    const isPremium = planName.includes("pro") || planName.includes("business");

    // Fetch full tenant details for context injection
    const tenant = await db.tenant.findUnique({
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

    const body = await request.json();
    const validated = chatSchema.parse(body);
    const { messages } = validated;

    const systemPrompt = `You are a helpful AI assistant integrated into ${tenant?.name || "ReplyBase"}. 
You are currently serving a ${planName.toUpperCase()} tier customer. 
${isPremium ? "Provide detailed, expert-level assistance and prioritize accuracy and deep reasoning. You have access to more advanced models." : "Provide concise and helpful answers."}
The current workspace is ${tenant?.name || "unknown"}.`;

    const promptMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages,
    ];

    // Use the Vercel AI SDK to stream AI output
    const aiStream = await streamText({
      model,
      messages: promptMessages,
      onFinish: async () => {
        await incrementTenantUsage(tenantId, "message", 1);
      },
    });

    // Use the SDK's built-in streaming response for Next.js
    return aiStream.toTextStreamResponse({
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-AI-Responses-Limit": String(aiMessageQuota.limit),
        "X-AI-Responses-Remaining": String(aiMessageQuota.remaining),
        "X-Automations-Limit": String(limits.flowExecutionCap),
        "X-Automations-Remaining": String(
          Math.max(limits.flowExecutionCap - automationCount, 0),
        ),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    }
    console.error("[AI Chat API] Error:", err);
    return NextResponse.json(
      {
        error: "AI Provider error",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
});
