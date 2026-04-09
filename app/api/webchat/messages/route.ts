import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyWebchatSessionToken } from "@/lib/webchat-session";
import {
  createWebchatCorsHeaders,
  getWebchatOriginRejectionReason,
  isWebchatOriginAllowed,
} from "@/lib/webchat-cors";
import { isOriginAllowedForSite } from "@/lib/webchat";
import { getWebchatRolloutDecision } from "@/lib/webchat-rollout";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  token: z.string().min(1),
  after: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(request: NextRequest) {
  try {
    if (!isWebchatOriginAllowed(request)) {
      const reason = getWebchatOriginRejectionReason(request);
      return NextResponse.json(
        { error: "Origin not allowed", reason },
        { status: 403, headers: createWebchatCorsHeaders(request) },
      );
    }

    const parsed = querySchema.safeParse({
      token: request.nextUrl.searchParams.get("token"),
      after: request.nextUrl.searchParams.get("after") || undefined,
      limit: request.nextUrl.searchParams.get("limit") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400, headers: createWebchatCorsHeaders(request) },
      );
    }

    const afterDate = parsed.data.after ? new Date(parsed.data.after) : null;
    if (afterDate && Number.isNaN(afterDate.getTime())) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: [{ path: ["after"], message: "Invalid date" }],
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

    const rollout = await getWebchatRolloutDecision(session.tenantId);
    if (!rollout.allowed) {
      return NextResponse.json(
        {
          error: "Webchat is not enabled for this tenant",
          reason: rollout.reason,
        },
        { status: 403, headers: createWebchatCorsHeaders(request) },
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

    const requestOrigin = request.headers.get("origin") || undefined;
    const requestReferer = request.headers.get("referer") || undefined;

    if (!isOriginAllowedForSite(site, requestOrigin, requestReferer)) {
      return NextResponse.json(
        { error: "Origin not allowed for this site" },
        { status: 403, headers: createWebchatCorsHeaders(request) },
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
            conversationId: session.conversationId,
            visitorId: session.visitorId,
          },
          orderBy: { updatedAt: "desc" },
        });

    if (webChatSession) {
      await prisma.webChatSession.update({
        where: { id: webChatSession.id },
        data: { lastSeenAt: new Date() },
      });
    }

    const messages = await prisma.crmMessage.findMany({
      where: {
        conversationId: session.conversationId,
        direction: "outbound",
        source: "human",
        ...(afterDate ? { createdAt: { gt: afterDate } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: parsed.data.limit ?? 20,
      select: {
        id: true,
        content: true,
        source: true,
        createdAt: true,
      },
    });

    const cursor =
      messages.length > 0
        ? messages[messages.length - 1].createdAt.toISOString()
        : parsed.data.after || new Date().toISOString();

    return NextResponse.json(
      {
        conversationId: session.conversationId,
        cursor,
        messages: messages.map((message) => ({
          id: message.id,
          text: message.content,
          source: message.source,
          createdAt: message.createdAt.toISOString(),
        })),
      },
      { headers: createWebchatCorsHeaders(request) },
    );
  } catch (error) {
    console.error("[Webchat Messages] Failed to fetch manual replies:", error);
    return NextResponse.json(
      { error: "Failed to fetch webchat messages" },
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
