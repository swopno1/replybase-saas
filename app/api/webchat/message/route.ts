import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createWebchatCorsHeaders,
  getWebchatOriginRejectionReason,
  isWebchatOriginAllowed,
} from "@/lib/webchat-cors";

export async function POST(request: NextRequest) {
  if (!isWebchatOriginAllowed(request)) {
    const reason = getWebchatOriginRejectionReason(request);
    return NextResponse.json(
      { error: "Origin not allowed", reason },
      { status: 403, headers: createWebchatCorsHeaders(request) },
    );
  }

  try {
    const body = await request.json();
    const { conversationId, botId, message, planName } = body;
    // Defensive: require all fields
    if (!conversationId || !botId || !message || !planName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: createWebchatCorsHeaders(request) },
      );
    }

    // Fetch last messages for context
    const lastMessages = await prisma.crmMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { content: true, source: true },
    });
    const aiMessages = lastMessages.reverse().map((msg) => ({
      role: msg.source === "human" ? "user" : "assistant",
      content: msg.content,
    }));
    aiMessages.push({ role: "user", content: message });

    // Dynamically import aiFallback to avoid circular deps
    const { aiFallback } = await import("@/lib/ai-fallback");
    let aiText = "";
    try {
      const aiStream = await aiFallback({
        botId,
        conversationId,
        messages: aiMessages,
        planName,
      });
      aiText =
        aiStream && "text" in aiStream
          ? await aiStream.text
          : String(aiStream ?? "");
    } catch (aiError) {
      // Defensive: fallback to static message
      aiText = "Our AI Agent is under development! We'll be up again soon.";
    }

    if (aiText.trim()) {
      await prisma.crmMessage.create({
        data: {
          conversationId,
          direction: "outbound",
          content: aiText.trim(),
          source: "ai",
        },
      });
      return NextResponse.json({
        responses: [
          {
            type: "text",
            text: aiText.trim(),
          },
        ],
        meta: { mode: "ai_fallback" },
      });
    }

    // Static fallback if all else fails
    return NextResponse.json({
      responses: [
        {
          type: "text",
          text: "Our AI Agent is under development! We'll be up again soon.",
        },
      ],
      meta: { mode: "safe_fallback" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: createWebchatCorsHeaders(request) },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  if (!isWebchatOriginAllowed(request)) {
    const reason = getWebchatOriginRejectionReason(request);
    return NextResponse.json(
      { error: "Origin not allowed", reason },
      {
        status: 403,
        headers: createWebchatCorsHeaders(request),
      },
    );
  }

  return new NextResponse(null, {
    status: 204,
    headers: createWebchatCorsHeaders(request),
  });
}
