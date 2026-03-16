import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyWebchatSessionToken } from "@/lib/webchat-session";
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
import {
  getWebchatTelemetryPolicy,
  normalizeWebchatTelemetryPayload,
  shouldSampleWebchatTelemetry,
} from "@/lib/webchat-telemetry";

const eventSchema = z.object({
  token: z.string().min(1),
  type: z.enum(["OPEN", "CLOSE", "TYPING", "ERROR", "MESSAGE"]),
  payload: z.record(z.string(), z.unknown()).optional(),
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
    const parsed = eventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parsed.error.issues,
        },
        { status: 400, headers: createWebchatCorsHeaders(request) },
      );
    }

    let sessionToken;
    try {
      sessionToken = verifyWebchatSessionToken(parsed.data.token);
    } catch {
      return NextResponse.json(
        { error: "Invalid session token" },
        { status: 401, headers: createWebchatCorsHeaders(request) },
      );
    }

    const site = sessionToken.siteId
      ? await prisma.webChatSite.findUnique({
          where: { id: sessionToken.siteId },
        })
      : await prisma.webChatSite.findFirst({
          where: {
            channelId: sessionToken.channelId,
            botId: sessionToken.botId,
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
      scope: "events_ip",
      key: `${getWebchatLimiterKeyFromRequest(request)}:${site.id}`,
    });

    if (!ipRateLimit.allowed) {
      await recordWebchatErrorEvent({
        siteId: site.id,
        reason: "rate_limit",
        stage: "events",
        payload: {
          scope: "events_ip",
          message:
            "Too many webchat events from this network. Please retry shortly.",
        },
      });

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message:
            "Too many webchat events from this network. Please retry shortly.",
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

    const requestOrigin = request.headers.get("origin") || undefined;
    const requestReferer = request.headers.get("referer") || undefined;

    const sessionRateLimit = consumeWebchatRateLimit({
      scope: "events_session",
      key: `${sessionToken.siteId || sessionToken.channelId}:${sessionToken.visitorId}`,
    });

    if (!sessionRateLimit.allowed) {
      await recordWebchatErrorEvent({
        siteId: site.id,
        reason: "rate_limit",
        stage: "events",
        payload: {
          scope: "events_session",
          message:
            "Too many events in this chat session. Please retry shortly.",
        },
      });

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message:
            "Too many events in this chat session. Please retry shortly.",
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

    if (!isOriginAllowedForSite(site, requestOrigin, requestReferer)) {
      await recordWebchatErrorEvent({
        siteId: site.id,
        reason: "blocked_origin",
        stage: "events",
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

    const telemetryPolicy = getWebchatTelemetryPolicy(parsed.data.type);
    const sampled = shouldSampleWebchatTelemetry(parsed.data.type);

    if (!sampled) {
      return NextResponse.json(
        { ok: true, sampled: false, sampleRate: telemetryPolicy.sampleRate },
        { headers: createWebchatCorsHeaders(request) },
      );
    }

    const webChatSession = await prisma.webChatSession.findFirst({
      where: {
        siteId: site.id,
        visitorId: sessionToken.visitorId,
      },
      orderBy: { updatedAt: "desc" },
    });

    await prisma.webChatEvent.create({
      data: {
        siteId: site.id,
        sessionId: webChatSession?.id || null,
        type: parsed.data.type,
        payload: {
          ...normalizeWebchatTelemetryPayload(
            parsed.data.type,
            parsed.data.payload,
          ),
          origin: requestOrigin || null,
          referer: requestReferer || null,
          sampleRate: telemetryPolicy.sampleRate,
          sampled: true,
        },
      },
    });

    if (webChatSession) {
      await prisma.webChatSession.update({
        where: { id: webChatSession.id },
        data: { lastSeenAt: new Date() },
      });
    }

    return NextResponse.json(
      { ok: true, sampled: true, sampleRate: telemetryPolicy.sampleRate },
      { headers: createWebchatCorsHeaders(request) },
    );
  } catch (error) {
    console.error("[Webchat Events] Failed to process event:", error);
    return NextResponse.json(
      { error: "Failed to process webchat event" },
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
