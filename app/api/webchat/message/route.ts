import { NextRequest, NextResponse } from "next/server";
import { ModelMessage } from "ai";
import { prisma } from "@/lib/prisma";
import { createWebchatCorsHeaders, getWebchatOriginRejectionReason, isWebchatOriginAllowed } from "@/lib/webchat-cors";
import { findActiveWebChannel } from "@/lib/webchat";
import { verifyWebchatSessionToken } from "@/lib/webchat-session";
import logger from "@/lib/logger";

export async function POST(request: NextRequest) {
  if (!isWebchatOriginAllowed(request)) {
    const reason = getWebchatOriginRejectionReason(request);
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
    const { tenantId } = session;
    if (!conversationId || !botId || !message || !planName) { logger.error({ conversationId, botId, message, planName }, "[Webchat Message] Missing required fields"); return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: createWebchatCorsHeaders(request) }); }
    try { await prisma.idempotencyKey.create({ data: { key: lockKey, expiresAt: new Date(Date.now() + 1000 * 60 * 5) } }); }
    catch (e: unknown) { if (typeof e === "object" && e !== null && "code" in e && (e as any).code === "P2002") { const existing = await prisma.idempotencyKey.findUnique({ where: { key: lockKey } }); if (existing && existing.expiresAt > new Date()) { logger.warn({ conversationId }, "[Webchat Message] Concurrent duplicate blocked"); return NextResponse.json({ status: "duplicate_ignored" }, { status: 200, headers: createWebchatCorsHeaders(request) }); } else { await prisma.idempotencyKey.update({ where: { key: lockKey }, data: { createdAt: new Date(), expiresAt: new Date(Date.now() + 1000 * 60 * 5) } }); } } else throw e; }
    await prisma.crmMessage.create({ data: { tenantId, conversationId, direction: "inbound", content: message.trim(), source: "human" } });
    const channel = await findActiveWebChannel({ botId });
    if (!channel) { logger.error({ botId }, "[Webchat Message] Channel not found"); return NextResponse.json({ error: "Channel not found" }, { status: 404, headers: createWebchatCorsHeaders(request) }); }
    const config = (channel.config || {}) as Record<string, unknown>;
    const fallbackMode = (config.fallbackMode as string) || "ai";
    const customFallbackMessage = ((config.customFallbackMessage as string) || "All of our agents are currently busy or offline. Please leave your email address, and we'll get back to you as soon as possible.") as string;
    if (fallbackMode === "manual") { logger.warn({ conversationId, botId }, "[Webchat Message] Manual fallback mode active"); await prisma.crmMessage.create({ data: { tenantId, conversationId, direction: "outbound", content: customFallbackMessage, source: "manual_fallback" } }); return NextResponse.json({ responses: [{ type: "text", text: customFallbackMessage }], meta: { mode: "manual_fallback" } }, { headers: createWebchatCorsHeaders(request) }); }
    const conversation = await prisma.crmConversation.findUnique({ where: { id: conversationId }, select: { contactId: true, metadata: true } });
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
      return NextResponse.json({ responses: flowResult.responses, meta: { mode: "flow", flowId: flowResult.flowId } }, { headers: createWebchatCorsHeaders(request) });
    }
    const lastMessages = await prisma.crmMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: 10, select: { content: true, source: true } });
    const aiMessages: ModelMessage[] = lastMessages.reverse().map((msg) => ({ role: msg.source === "human" ? "user" : "assistant", content: msg.content }));
    if (aiMessages.length === 0 || aiMessages[aiMessages.length - 1].content !== message) { aiMessages.push({ role: "user", content: message }); }
    const { aiFallback } = await import("@/lib/ai-fallback");
    let aiText = "", aiErrorOccurred = false;
    try {
      const aiStream = await aiFallback({ botId, conversationId, messages: aiMessages, planName });
      aiText = aiStream && "text" in aiStream ? (await aiStream.text) as string : String(aiStream ?? "");
    } catch (aiError) {
      aiErrorOccurred = true;
      const isQuotaError = String(aiError).includes("RESOURCE_EXHAUSTED") || String(aiError).includes("429");
      const isTimeout = String(aiError).toLowerCase().includes("timeout") || String(aiError).toLowerCase().includes("abort");
      aiText = isQuotaError ? "I'm experiencing high demand right now." : isTimeout ? "I'm taking a bit longer than usual." : customFallbackMessage;
      logger.error({ error: aiError, isQuotaError, isTimeout }, "[Webchat Message] AI error, using fallback");
    }
    if (aiText.trim()) {
      await prisma.crmMessage.create({ data: { tenantId, conversationId, direction: "outbound", content: aiText.trim(), source: aiErrorOccurred ? "manual_fallback" : "ai" } });
      logger.info({ mode: aiErrorOccurred ? "manual_fallback" : "ai_fallback", aiText }, "[Webchat Message] Responding");
      return NextResponse.json({ responses: [{ type: "text", text: aiText.trim() }], meta: { mode: aiErrorOccurred ? "manual_fallback" : "ai_fallback" } }, { headers: createWebchatCorsHeaders(request) });
    }
    logger.error({ conversationId, botId }, "[Webchat Message] All fallbacks failed");
    return NextResponse.json({ responses: [{ type: "text", text: customFallbackMessage }], meta: { mode: "safe_fallback" } }, { headers: createWebchatCorsHeaders(request) });
  } catch (error) { logger.error({ error }, "[Webchat Message] Internal server error"); return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: createWebchatCorsHeaders(request) }); }
  finally { try { await prisma.idempotencyKey.delete({ where: { key: lockKey } }); } catch (e) {} }
}
export async function OPTIONS(request: NextRequest) {
  if (!isWebchatOriginAllowed(request)) {
    const reason = getWebchatOriginRejectionReason(request);
    return NextResponse.json({ error: "Origin not allowed", reason }, { status: 403, headers: createWebchatCorsHeaders(request) });
  }
  return new NextResponse(null, { status: 204, headers: createWebchatCorsHeaders(request) });
}
