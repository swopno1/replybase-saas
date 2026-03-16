import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { converse, AiEngineError } from "@/lib/ai-engine";
import { verifyWebchatSessionToken } from "@/lib/webchat-session";
import { prisma } from "@/lib/prisma";
import {
  createWebchatCorsHeaders,
  isWebchatOriginAllowed,
} from "@/lib/webchat-cors";
import { isOriginAllowedForSite } from "@/lib/webchat";
import {
  consumeWebchatRateLimit,
  createWebchatRateLimitHeaders,
  getWebchatLimiterKeyFromRequest,
} from "@/lib/webchat-rate-limit";
import { recordWebchatErrorEvent } from "@/lib/webchat-diagnostics";

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

    const site = session.siteId
      ? await prisma.webChatSite.findUnique({
          where: { id: session.siteId },
        })
      : await prisma.webChatSite.findFirst({
          where: {
            channelId: session.channelId,
            botId: session.botId,
            isActive: true,
          },
        });

    if (!site) {
      return NextResponse.json(
        { error: "Webchat site not found" },
        { status: 404, headers: createWebchatCorsHeaders(request) },
      );
    }

    const ipRateLimit = consumeWebchatRateLimit({
      scope: "message_ip",
      key: `${getWebchatLimiterKeyFromRequest(request)}:${site.id}`,
    });

    if (!ipRateLimit.allowed) {
      await recordWebchatErrorEvent({
        siteId: site.id,
        reason: "rate_limit",
        stage: "message",
        payload: {
          scope: "message_ip",
          message:
            "Too many webchat messages from this network. Please retry shortly.",
        },
      });

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message:
            "Too many webchat messages from this network. Please retry shortly.",
        },
        {
          status: 429,
          headers: {
            ...createWebchatCorsHeaders(request),
            ...createWebchatRateLimitHeaders(ipRateLimit),
          },
        },
      );
    }

    const sessionRateLimit = consumeWebchatRateLimit({
      scope: "message_session",
      key: `${session.siteId || session.channelId}:${session.visitorId}`,
    });

    if (!sessionRateLimit.allowed) {
      await recordWebchatErrorEvent({
        siteId: site.id,
        reason: "rate_limit",
        stage: "message",
        payload: {
          scope: "message_session",
          message:
            "Too many messages in this chat session. Please wait and try again.",
        },
      });

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message:
            "Too many messages in this chat session. Please wait and try again.",
        },
        {
          status: 429,
          headers: {
            ...createWebchatCorsHeaders(request),
            ...createWebchatRateLimitHeaders(sessionRateLimit),
          },
        },
      );
    }

    const requestOrigin = request.headers.get("origin") || undefined;
    const requestReferer = request.headers.get("referer") || undefined;

    if (!isOriginAllowedForSite(site, requestOrigin, requestReferer)) {
      await recordWebchatErrorEvent({
        siteId: site.id,
        reason: "blocked_origin",
        stage: "message",
        payload: {
          origin: requestOrigin || null,
          referer: requestReferer || null,
          message: "Origin not allowed for this site",
        },
      });

      return NextResponse.json(
        { error: "Origin not allowed for this site" },
        { status: 403, headers: createWebchatCorsHeaders(request) },
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

    const webChatSession = session.siteId
      ? await prisma.webChatSession.findFirst({
          where: {
            siteId: session.siteId,
            visitorId: session.visitorId,
          },
        })
      : await prisma.webChatSession.findFirst({
          where: {
            visitorId: session.visitorId,
            site: {
              channelId: session.channelId,
              botId: session.botId,
            },
          },
          orderBy: { updatedAt: "desc" },
        });

    const aiResult = await converse({
      botId: session.botId,
      tenantId: session.tenantId,
      conversationId: session.conversationId,
      channel: "web",
      message: parsed.data.message,
    });

    if (webChatSession) {
      await prisma.webChatSession.update({
        where: { id: webChatSession.id },
        data: {
          conversationId: session.conversationId,
          externalSessionId: aiResult.sessionId || null,
          lastSeenAt: new Date(),
        },
      });

      await prisma.webChatEvent.create({
        data: {
          siteId: webChatSession.siteId,
          sessionId: webChatSession.id,
          type: "MESSAGE",
          payload: {
            messageLength: parsed.data.message.length,
            responseCount: Array.isArray(aiResult.responses)
              ? aiResult.responses.length
              : 0,
          },
        },
      });
    }

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
