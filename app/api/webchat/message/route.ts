import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { converse, AiEngineError } from "@/lib/ai-engine";
import { verifyWebchatSessionToken } from "@/lib/webchat-session";
import { prisma } from "@/lib/prisma";
import {
  createWebchatCorsHeaders,
  isWebchatOriginAllowed,
} from "@/lib/webchat-cors";

const messageSchema = z.object({
  token: z.string().min(1),
  message: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    if (!isWebchatOriginAllowed(request)) {
      return NextResponse.json(
        { error: "Origin not allowed" },
        { status: 403, headers: createWebchatCorsHeaders(request) },
      );
    }

    const body = await request.json();
    const parsed = messageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parsed.error.issues,
        },
        { status: 400, headers: createWebchatCorsHeaders(request) },
      );
    }

    let session;
    try {
      session = verifyWebchatSessionToken(parsed.data.token);
    } catch {
      return NextResponse.json(
        { error: "Invalid session token" },
        { status: 401, headers: createWebchatCorsHeaders(request) },
      );
    }

    const conversation = await prisma.crmConversation.findUnique({
      where: { id: session.conversationId },
      select: {
        id: true,
        botId: true,
        channel: true,
      },
    });

    if (
      !conversation ||
      conversation.botId !== session.botId ||
      conversation.channel !== "web"
    ) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404, headers: createWebchatCorsHeaders(request) },
      );
    }

    const aiResult = await converse({
      botId: session.botId,
      tenantId: session.tenantId,
      conversationId: session.conversationId,
      channel: "web",
      message: parsed.data.message,
    });

    return NextResponse.json(
      {
        conversationId: session.conversationId,
        sessionId: aiResult.sessionId,
        responses: aiResult.responses,
      },
      { headers: createWebchatCorsHeaders(request) },
    );
  } catch (error) {
    if (error instanceof AiEngineError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: createWebchatCorsHeaders(request) },
      );
    }

    console.error("[Webchat Message] Failed to process message:", error);
    return NextResponse.json(
      { error: "Failed to process webchat message" },
      { status: 500, headers: createWebchatCorsHeaders(request) },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  if (!isWebchatOriginAllowed(request)) {
    return new NextResponse(null, {
      status: 403,
      headers: createWebchatCorsHeaders(request),
    });
  }

  return new NextResponse(null, {
    status: 204,
    headers: createWebchatCorsHeaders(request),
  });
}
