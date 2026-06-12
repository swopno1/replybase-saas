import { NextRequest, NextResponse } from "next/server";
import { ModelMessage } from "ai";
import { prisma } from "@/lib/prisma";
import { createWebchatCorsHeaders, getWebchatOriginRejectionReason, isWebchatOriginAllowed } from "@/lib/webchat-cors";
import { findActiveWebChannel, resolveWebchatVisitorSession } from "@/lib/webchat";
import { verifyWebchatSessionToken, createWebchatSessionToken } from "@/lib/webchat-session";
import { leadService } from "@/lib/services/lead-service";
import logger from "@/lib/logger";

export async function POST(request: NextRequest) {
  if (!(await isWebchatOriginAllowed(request))) {
    const reason = await getWebchatOriginRejectionReason(request);
    logger.error({ origin: request.headers.get("origin"), referer: request.headers.get("referer"), reason }, "[Webchat Message] Blocked by CORS");
    return NextResponse.json({ error: "Origin not allowed", reason }, { status: 403, headers: createWebchatCorsHeaders(request) });
  }
  const body = await request.json();
  const { token, conversationId, botId, message, planName } = body;
  const lockKey = `${conversationId}:${String(message || "").trim()}`;
  try {
    logger.info({ body }, "[Webchat Message] Incoming request");
    let session;
    try { session = verifyWebchatSessionToken(token); } catch (err) { logger.error({ error: err }, "[Webchat Message] Invalid token"); return NextResponse.json({ error: "Invalid session" }, { status: 401, headers: createWebchatCorsHeaders(request) }); }
    let { tenantId, isShadow } = session;
    if (!conversationId || !botId || !message || !planName) { logger.error({ conversationId, botId, message, planName }, "[Webchat Message] Missing required fields"); return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: createWebchatCorsHeaders(request) }); }

    if (isShadow) {
      logger.info({ conversationId, visitorId: session.visitorId }, "[Webchat Message] Promoting shadow session to DB");
      const resolved = await resolveWebchatVisitorSession({
        siteId: session.siteId || "",
        botId,
        tenantId,
        channelId: session.channelId,
        visitorId: session.visitorId,
        conversationId: session.conversationId,
        metadata: body.metadata,
      });
      tenantId = resolved.contact.tenantId;

      // Create INIT event on promotion
      await prisma.webChatEvent.create({
        data: {
          siteId: session.siteId || "",
          sessionId: resolved.webChatSession.id,
          type: "INIT",
          payload: { promoted: true, ...body.metadata },
        },
      });
    }
    const idempotencyExpiry = new Date(Date.now() + 1000 * 60 * 5);
    let conversation: { contactId: string; metadata: unknown } | null = null;
    let channel: Awaited<ReturnType<typeof findActiveWebChannel>> = null;

    try {
      const [txResult, ch] = await Promise.all([
        prisma.$transaction([
          prisma.idempotencyKey.create({ data: { key: lockKey, expiresAt: idempotencyExpiry } }),
          prisma.crmMessage.create({ data: { tenantId, conversationId, direction: "inbound", content: message.trim(), source: "human" } }),
          prisma.crmConversation.findUnique({ where: { id: conversationId }, select: { contactId: true, metadata: true } }),
        ]),
        findActiveWebChannel({ botId }),
      ]);
      conversation = txResult[2];
      channel = ch;
    } catch (e: unknown) {
      if (typeof e === "object" && e !== null && "code" in e && (e as any).code === "P2002") {
        const existing = await prisma.idempotencyKey.findUnique({ where: { key: lockKey } });
        if (existing && existing.expiresAt > new Date()) {
          logger.warn({ conversationId }, "[Webchat Message] Concurrent duplicate blocked");
          return NextResponse.json({ status: "duplicate_ignored" }, { status: 200, headers: createWebchatCorsHeaders(request) });
        }
        await prisma.idempotencyKey.update({ where: { key: lockKey }, data: { createdAt: new Date(), expiresAt: idempotencyExpiry } });
        const [txResult, ch] = await Promise.all([
          prisma.$transaction([
            prisma.crmMessage.create({ data: { tenantId, conversationId, direction: "inbound", content: message.trim(), source: "human" } }),
            prisma.crmConversation.findUnique({ where: { id: conversationId }, select: { contactId: true, metadata: true } }),
          ]),
          findActiveWebChannel({ botId }),
        ]);
        conversation = txResult[1];
        channel = ch;
      } else throw e;
    }
    
    // --- LEAD EXTRACTION ---
    // Automatically capture email/phone from any inbound message
    if (conversation) {
      await leadService.extractAndSyncLeadDataFromMessage(tenantId, conversation.contactId, message);
    }

    if (!channel) { logger.error({ botId }, "[Webchat Message] Channel not found"); return NextResponse.json({ error: "Channel not found" }, { status: 404, headers: createWebchatCorsHeaders(request) }); }
    const config = (channel.config || {}) as Record<string, unknown>;
    const fallbackMode = (config.fallbackMode as string) || "ai";
    const customFallbackMessage = ((config.customFallbackMessage as string) || "All of our agents are currently busy or offline. Please leave your email address, and we'll get back to you as soon as possible.") as string;
    if (fallbackMode === "manual") { logger.warn({ conversationId, botId }, "[Webchat Message] Manual fallback mode active"); await prisma.crmMessage.create({ data: { tenantId, conversationId, direction: "outbound", content: customFallbackMessage, source: "manual_fallback" } }); return NextResponse.json({ responses: [{ type: "text", text: customFallbackMessage }], meta: { mode: "manual_fallback" } }, { headers: createWebchatCorsHeaders(request) }); }
    
    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404, headers: createWebchatCorsHeaders(request) });
    const { buildWebchatSourceContext, executeWebchatFlowFirst } = await import("@/lib/webchat-conversation-engine");
    const sourceContext = buildWebchatSourceContext({ requestOrigin: request.headers.get("origin"), requestReferer: request.headers.get("referer"), messageMetadata: body.metadata as Record<string, unknown> | undefined, existingMetadata: conversation.metadata as Record<string, unknown> | undefined });
    const flowResult = await executeWebchatFlowFirst({ tenantId: channel.bot.tenantId, botId, contactId: conversation.contactId, siteId: String((conversation.metadata as Record<string, unknown>)?.siteId || channel.id), message, channelId: channel.id, sourceContext });
    if (flowResult && flowResult.handled) {
      if (flowResult.responses.length > 0) {
        const outMessages = flowResult.responses.filter((r) => r.type === "text").map((r) => (r as { type: "text"; text: string }).text);
        await prisma.crmMessage.createMany({ data: outMessages.map((outMsg) => ({ tenantId, conversationId, direction: "outbound", content: outMsg, source: "flow" })) });
        logger.info({ responses: flowResult.responses }, "[Webchat Message] Responding from flow");
      }
      // Update token to be non-shadow for subsequent messages
      const newToken = createWebchatSessionToken({
        siteId: session.siteId,
        channelId: session.channelId,
        botId: session.botId,
        tenantId: tenantId,
        conversationId: session.conversationId,
        visitorId: session.visitorId,
        isShadow: false,
      });

      return NextResponse.json({ 
        responses: flowResult.responses, 
        meta: { 
          mode: "flow", 
          flowId: flowResult.flowId,
          syncHash: flowResult.syncHash,
          token: newToken
        } 
      }, { headers: createWebchatCorsHeaders(request) });
    }
    const lastMessages = await prisma.crmMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: 10, select: { content: true, source: true } });
    const aiMessages: ModelMessage[] = lastMessages.reverse().map((msg) => ({ role: msg.source === "human" ? "user" : "assistant", content: msg.content }));
    if (aiMessages.length === 0 || aiMessages[aiMessages.length - 1].content !== message) { aiMessages.push({ role: "user", content: message }); }
    const { aiFallback } = await import("@/lib/ai-fallback");
    try {
      const aiStream = await aiFallback({ botId, conversationId, messages: aiMessages, planName });
      if (aiStream && typeof aiStream === "object" && "toDataStreamResponse" in aiStream) {
        // Vercel AI SDK 3.1+ style streaming
        return (aiStream as any).toDataStreamResponse({
          headers: createWebchatCorsHeaders(request) as any,
          onFinished: async (completion: string) => {
            await prisma.crmMessage.create({
              data: {
                tenantId,
                conversationId,
                direction: "outbound",
                content: completion.trim(),
                source: "ai",
              },
            });
            logger.info({ conversationId }, "[Webchat Message] AI response finished and saved");
          },
        });
      }

      // Fallback for older versions or non-stream results
      const aiText = aiStream && typeof aiStream === "object" && "text" in aiStream ? (await (aiStream as any).text) as string : String(aiStream ?? "");
      if (aiText.trim()) {
        await prisma.crmMessage.create({ data: { tenantId, conversationId, direction: "outbound", content: aiText.trim(), source: "ai" } });
        
        const metadata: any = { mode: "ai_fallback" };
        if (isShadow) {
          metadata.token = createWebchatSessionToken({
            siteId: session.siteId,
            channelId: session.channelId,
            botId: session.botId,
            tenantId: tenantId,
            conversationId: session.conversationId,
            visitorId: session.visitorId,
            isShadow: false,
          });
        }

        return NextResponse.json({ responses: [{ type: "text", text: aiText.trim() }], meta: metadata }, { headers: createWebchatCorsHeaders(request) });
      }
    } catch (aiError) {
      const isQuotaError = String(aiError).includes("RESOURCE_EXHAUSTED") || String(aiError).includes("429");
      const isTimeout = String(aiError).toLowerCase().includes("timeout") || String(aiError).toLowerCase().includes("abort");
      const aiText = isQuotaError ? "I'm experiencing high demand right now." : isTimeout ? "I'm taking a bit longer than usual." : customFallbackMessage;
      logger.error({ error: aiError, isQuotaError, isTimeout }, "[Webchat Message] AI error, using fallback");
      await prisma.crmMessage.create({ data: { tenantId, conversationId, direction: "outbound", content: aiText.trim(), source: "manual_fallback" } });
      
      const metadata: any = { mode: "manual_fallback" };
      if (isShadow) {
        metadata.token = createWebchatSessionToken({
          siteId: session.siteId,
          channelId: session.channelId,
          botId: session.botId,
          tenantId: tenantId,
          conversationId: session.conversationId,
          visitorId: session.visitorId,
          isShadow: false,
        });
      }

      return NextResponse.json({ responses: [{ type: "text", text: aiText.trim() }], meta: metadata }, { headers: createWebchatCorsHeaders(request) });
    }
    logger.error({ conversationId, botId }, "[Webchat Message] All fallbacks failed");
    return NextResponse.json({ responses: [{ type: "text", text: customFallbackMessage }], meta: { mode: "safe_fallback" } }, { headers: createWebchatCorsHeaders(request) });
  } catch (error) { logger.error({ error }, "[Webchat Message] Internal server error"); return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: createWebchatCorsHeaders(request) }); }
  finally {
    // We leave the idempotency key until it expires naturally to prevent
    // duplicates from rapid retries or concurrent events.
  }
}
export async function OPTIONS(request: NextRequest) {
  if (!(await isWebchatOriginAllowed(request))) {
    const reason = await getWebchatOriginRejectionReason(request);
    return NextResponse.json({ error: "Origin not allowed", reason }, { status: 403, headers: createWebchatCorsHeaders(request) });
  }
  return new NextResponse(null, { status: 204, headers: createWebchatCorsHeaders(request) });
}
