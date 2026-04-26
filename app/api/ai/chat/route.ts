import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
// import { checkAiQuota } from "@/lib/ai-quota"; // To be implemented
import { streamText, Output } from "ai";
import { getAiModel, AiProvider } from "@/lib/ai-service";
import { prisma } from "@/lib/prisma";
import {
  checkLimit,
  incrementUsage,
  getMonthlyConversationCount,
  getTenantLimits,
} from "@/lib/subscription";

export async function POST(req: NextRequest) {
  // Auth check
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Quota checks
  const aiMessageQuota = await checkLimit(session.user.id, "message");
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

  const tenantId = session.user.tenantId;
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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const messages = body?.messages;
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const systemPrompt = `You are a helpful AI assistant integrated into ${tenant?.name || "ReplyBase"}. 
You are currently serving a ${planName.toUpperCase()} tier customer. 
${isPremium ? "Provide detailed, expert-level assistance and prioritize accuracy and deep reasoning. You have access to more advanced models." : "Provide concise and helpful answers."}
The current workspace is ${tenant?.name || "unknown"}.`;

  const promptMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  try {
    // Use the Vercel AI SDK to stream AI output
    const aiStream = await streamText({
      model,
      messages: promptMessages as any,
      output: Output.text(),
    });

    // Increment AI message usage
    await incrementUsage(session.user.id, "message", 1);

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
    return NextResponse.json(
      {
        error: "AI Provider error",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
