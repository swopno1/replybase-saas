import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { converse, AiEngineError } from "@/lib/ai-engine";
import { verifyWebchatSessionToken } from "@/lib/webchat-session";
import { prisma } from "@/lib/prisma";
import {
  createWebchatCorsHeaders,
  getWebchatOriginRejectionReason,
  isWebchatOriginAllowed,
} from "@/lib/webchat-cors";
import { isOriginAllowedForSite } from "@/lib/webchat";
import {
  consumeWebchatRateLimit,
  createWebchatRateLimitHeaders,
  getWebchatLimiterKeyFromRequest,
} from "@/lib/webchat-rate-limit";
import { recordWebchatErrorEvent } from "@/lib/webchat-diagnostics";
import {
  buildWebchatSourceContext,
  executeWebchatFlowFirst,
  mergeConversationMetadata,
} from "@/lib/webchat-conversation-engine";

const messageSchema = z.object({
  token: z.string().min(1),
  message: z.string().min(1),
  metadata: z
    .object({
      pageUrl: z.string().url().optional(),
      url: z.string().url().optional(),
      referrer: z.string().url().optional(),
      locale: z.string().optional(),
      pageTitle: z.string().optional(),
      userAgent: z.string().optional(),
      origin: z.string().url().optional(),
      utmSource: z.string().optional(),
      utmMedium: z.string().optional(),
      utmCampaign: z.string().optional(),
      utmTerm: z.string().optional(),
      utmContent: z.string().optional(),
    })
    .optional(),
});

const SAFE_WEBCHAT_FALLBACK_MESSAGE =
  "I’m having trouble answering right now. Please try again in a moment, or leave your details and our team will follow up.";

export async function POST(request: NextRequest) {
  try {
    if (!isWebchatOriginAllowed(request)) {
      const reason = getWebchatOriginRejectionReason(request);
      return NextResponse.json(
        { error: "Origin not allowed", reason },
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

    const ipRateLimit = await consumeWebchatRateLimit({
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

    const sessionRateLimit = await consumeWebchatRateLimit({
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
        contactId: true,
        metadata: true,
        bot: {
          select: {
            id: true,
            name: true,
            entryFlow: true,
            welcomeMessage: true,
          },
        },
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

    const existingConversationMetadata =
      conversation.metadata &&
      typeof conversation.metadata === "object" &&
      !Array.isArray(conversation.metadata)
        ? (conversation.metadata as Record<string, unknown>)
        : null;

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

    const sessionMetadata =
      webChatSession?.metadata &&
      typeof webChatSession.metadata === "object" &&
      !Array.isArray(webChatSession.metadata)
        ? (webChatSession.metadata as Record<string, unknown>)
        : null;

    const sourceContext = buildWebchatSourceContext({
      requestOrigin,
      requestReferer,
      sessionMetadata,
      messageMetadata: parsed.data.metadata || null,
      existingMetadata: existingConversationMetadata,
    });

    await prisma.crmConversation.update({
      where: { id: conversation.id },
      data: {
        metadata: mergeConversationMetadata({
          existingMetadata: existingConversationMetadata,
          siteId: site.id,
          channelId: session.channelId,
          sourceContext,
        }),
      },
    });

    const flowResult = await executeWebchatFlowFirst({
      tenantId: session.tenantId,
      botId: session.botId,
      contactId: conversation.contactId,
      siteId: site.id,
      message: parsed.data.message,
      entryFlow: conversation.bot?.entryFlow,
      sourceContext,
    });

    if (flowResult?.handled) {
      for (const response of flowResult.responses) {
        await prisma.crmMessage.create({
          data: {
            conversationId: session.conversationId,
            direction: "outbound",
            content: response.text,
            source: "flow",
          },
        });
      }

      if (webChatSession) {
        await prisma.webChatSession.update({
          where: { id: webChatSession.id },
          data: {
            conversationId: session.conversationId,
            externalSessionId: `flow:${flowResult.flowSessionId}`,
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
              responseCount: flowResult.responses.length,
              responseSource: "flow",
              flowId: flowResult.flowId,
              flowName: flowResult.flowName,
            },
          },
        });
      }

      return NextResponse.json(
        {
          conversationId: session.conversationId,
          sessionId: flowResult.flowSessionId,
          responses: flowResult.responses,
          meta: {
            mode: "flow",
            flowId: flowResult.flowId,
            flowName: flowResult.flowName,
            completed: flowResult.completed,
            sourceContext,
          },
        },
        { headers: createWebchatCorsHeaders(request) },
      );
    }

    try {
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
              responseSource: "ai",
            },
          },
        });
      }

      return NextResponse.json(
        {
          conversationId: session.conversationId,
          sessionId: aiResult.sessionId,
          responses: aiResult.responses,
          meta: {
            mode: "ai",
            sourceContext,
          },
        },
        { headers: createWebchatCorsHeaders(request) },
      );
    } catch (error) {
      const fallbackText = SAFE_WEBCHAT_FALLBACK_MESSAGE;

      await recordWebchatErrorEvent({
        siteId: site.id,
        sessionId: webChatSession?.id || null,
        reason: "message_error",
        stage: "message",
        payload: {
          message: error instanceof Error ? error.message : "AI engine failed",
          fallbackText,
        },
      });

      await prisma.crmMessage.create({
        data: {
          conversationId: session.conversationId,
          direction: "outbound",
          content: fallbackText,
          source: "system",
        },
      });

      if (webChatSession) {
        await prisma.webChatSession.update({
          where: { id: webChatSession.id },
          data: {
            conversationId: session.conversationId,
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
              responseCount: 1,
              responseSource: "safe_fallback",
            },
          },
        });
      }

      return NextResponse.json(
        {
          conversationId: session.conversationId,
          sessionId: webChatSession?.externalSessionId || null,
          responses: [{ type: "text", text: fallbackText }],
          meta: {
            mode: "safe_fallback",
            sourceContext,
          },
        },
        { headers: createWebchatCorsHeaders(request) },
      );
    }
  } catch (error) {
    console.error("[Webchat Message] Failed to process message:", error);
    return NextResponse.json(
      { error: "Failed to process webchat message" },
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
