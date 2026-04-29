import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createWebchatCorsHeaders,
  getWebchatOriginRejectionReason,
  isWebchatOriginAllowed,
} from "@/lib/webchat-cors";
import { findActiveWebChannel } from "@/lib/webchat";

export async function POST(request: NextRequest) {
  if (!isWebchatOriginAllowed(request)) {
    const reason = getWebchatOriginRejectionReason(request);
    console.error("[Webchat Message] Blocked by CORS", {
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      reason,
    });
    return NextResponse.json(
      { error: "Origin not allowed", reason },
      { status: 403, headers: createWebchatCorsHeaders(request) },
    );
  }

  try {
    const body = await request.json();
    console.log("[Webchat Message] Incoming request", body);
    const { conversationId, botId, message, planName } = body;
    // Defensive: require all fields
    if (!conversationId || !botId || !message || !planName) {
      console.error("[Webchat Message] Missing required fields", {
        conversationId,
        botId,
        message,
        planName,
      });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: createWebchatCorsHeaders(request) },
      );
    }

    // Save inbound message immediately so the SaaS dashboard sees it
    await prisma.crmMessage.create({
      data: {
        conversationId,
        direction: "inbound",
        content: message.trim(),
        source: "human",
      },
    });

    // Fetch channel config for fallbackMode/customFallbackMessage
    const channel = await findActiveWebChannel({ botId });
    if (!channel) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404, headers: createWebchatCorsHeaders(request) },
      );
    }
    const config = (channel.config || {}) as Record<string, any>;
    const fallbackMode = config.fallbackMode || "ai";
    const customFallbackMessage =
      config.customFallbackMessage ||
      "Our AI Agent is under development! We'll be up again soon.";

    if (fallbackMode === "manual") {
      console.warn("[Webchat Message] Manual fallback mode active", {
        conversationId,
        botId,
      });
      await prisma.crmMessage.create({
        data: {
          conversationId,
          direction: "outbound",
          content: customFallbackMessage,
          source: "manual_fallback",
        },
      });
      return NextResponse.json(
        {
          responses: [
            {
              type: "text",
              text: customFallbackMessage,
            },
          ],
          meta: { mode: "manual_fallback" },
        },
        { headers: createWebchatCorsHeaders(request) }
      );
    }

    const conversation = await prisma.crmConversation.findUnique({
      where: { id: conversationId },
      select: { contactId: true, metadata: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404, headers: createWebchatCorsHeaders(request) },
      );
    }

    // Try executing assigned flow first natively
    const { buildWebchatSourceContext, executeWebchatFlowFirst } = await import(
      "@/lib/webchat-conversation-engine"
    );

    const sourceContext = buildWebchatSourceContext({
      requestOrigin: request.headers.get("origin"),
      requestReferer: request.headers.get("referer"),
      messageMetadata: body.metadata as Record<string, unknown> | undefined,
      existingMetadata: conversation.metadata as Record<string, unknown> | undefined,
    });

    const flowResult = await executeWebchatFlowFirst({
      tenantId: channel.bot.tenantId,
      botId,
      contactId: conversation.contactId,
      siteId: String((conversation.metadata as Record<string, any>)?.siteId || channel.id),
      message,
      channelId: channel.id,
      sourceContext,
    });

    if (flowResult && flowResult.handled) {
      if (flowResult.responses.length > 0) {
        const outMessages = flowResult.responses
          .filter((r) => r.type === "text")
          .map((r) => (r as { type: "text"; text: string }).text);

        if (outMessages.length > 0) {
          await prisma.crmMessage.createMany({
            data: outMessages.map((outMsg) => ({
              conversationId,
              direction: "outbound",
              content: outMsg,
              source: "flow",
            })),
          });
        }

        console.log("[Webchat Message] Responding from flow", {
          responses: flowResult.responses,
        });

        return NextResponse.json(
          {
            responses: flowResult.responses,
            meta: { mode: "flow", flowId: flowResult.flowId },
          },
          { headers: createWebchatCorsHeaders(request) },
        );
      }

      if (!flowResult.completed) {
        return NextResponse.json(
          {
            responses: flowResult.responses,
            meta: { mode: "flow", flowId: flowResult.flowId },
          },
          { headers: createWebchatCorsHeaders(request) },
        );
      }
    }

    // fallbackMode is "ai" or missing AND Flow bypassed: run AI, fallback to customFallbackMessage if AI fails
    // Fetch last messages for context

    const lastMessages = await prisma.crmMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { content: true, source: true },
    });
    const aiMessages = lastMessages.reverse().map((msg) => ({
      role: (msg.source === "human" ? "user" : "assistant") as any,
      content: msg.content,
    }));
    aiMessages.push({ role: "user" as any, content: message });

    // Dynamically import aiFallback to avoid circular deps
    const { aiFallback } = await import("@/lib/ai-fallback");
    let aiText = "";
    let aiErrorOccurred = false;
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
      aiErrorOccurred = true;
      aiText = customFallbackMessage;
      console.error("[Webchat Message] AI error, using fallback", {
        error: aiError,
      });
    }

    if (aiText.trim()) {
      await prisma.crmMessage.create({
        data: {
          conversationId,
          direction: "outbound",
          content: aiText.trim(),
          source: aiErrorOccurred ? "manual_fallback" : "ai",
        },
      });
      console.log("[Webchat Message] Responding", {
        mode: aiErrorOccurred ? "manual_fallback" : "ai_fallback",
        aiText,
      });
      return NextResponse.json(
        {
          responses: [
            {
              type: "text",
              text: aiText.trim(),
            },
          ],
          meta: { mode: aiErrorOccurred ? "manual_fallback" : "ai_fallback" },
        },
        { headers: createWebchatCorsHeaders(request) }
      );
    }

    // Static fallback if all else fails
    console.error(
      "[Webchat Message] All fallbacks failed, using static fallback",
      { conversationId, botId },
    );
    return NextResponse.json(
      {
        responses: [
          {
            type: "text",
            text: customFallbackMessage,
          },
        ],
        meta: { mode: "safe_fallback" },
      },
      { headers: createWebchatCorsHeaders(request) }
    );
  } catch (error) {
    console.error("[Webchat Message] Internal server error", { error });
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
