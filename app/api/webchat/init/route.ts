import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createWebchatSessionToken } from "@/lib/webchat-session";
import {
  findActiveWebChatSite,
  findActiveWebChannel,
  getOrCreateWebChatSite,
  isOriginAllowedForSite,
  resolveWebchatVisitorSession,
} from "@/lib/webchat";
import {
  createWebchatCorsHeaders,
  isWebchatOriginAllowed,
} from "@/lib/webchat-cors";
import {
  consumeWebchatRateLimit,
  createWebchatRateLimitHeaders,
  getWebchatLimiterKeyFromRequest,
} from "@/lib/webchat-rate-limit";

const initSchema = z
  .object({
    publicKey: z.string().min(1).optional(),
    channelId: z.string().min(1).optional(),
    botId: z.string().min(1).optional(),
    origin: z.string().url().optional(),
    visitorId: z.string().min(1).optional(),
    visitorContext: z
      .object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      })
      .optional(),
    contact: z
      .object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      })
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.publicKey && !data.channelId && !data.botId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide publicKey, channelId, or botId",
        path: ["publicKey"],
      });
    }
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
    const parsed = initSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: parsed.error.issues,
        },
        { status: 400, headers: createWebchatCorsHeaders(request) },
      );
    }

    const initRateLimit = consumeWebchatRateLimit({
      scope: "init_ip",
      key: `${getWebchatLimiterKeyFromRequest(request)}:${parsed.data.publicKey || parsed.data.channelId || parsed.data.botId || "unknown"}`,
    });

    if (!initRateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message:
            "Too many webchat initialization requests. Please retry shortly.",
        },
        {
          status: 429,
          headers: {
            ...createWebchatCorsHeaders(request),
            ...createWebchatRateLimitHeaders(initRateLimit),
          },
        },
      );
    }

    const requestOrigin = request.headers.get("origin") || undefined;
    const requestReferer = request.headers.get("referer") || undefined;
    const inputOrigin = parsed.data.origin;

    const siteFromKey = parsed.data.publicKey
      ? await findActiveWebChatSite({ publicKey: parsed.data.publicKey })
      : null;

    let channel = null;
    if (!siteFromKey) {
      channel = await findActiveWebChannel({
        channelId: parsed.data.channelId,
        botId: parsed.data.botId,
      });

      if (!channel?.bot) {
        return NextResponse.json(
          { error: "Active web channel not found" },
          { status: 404, headers: createWebchatCorsHeaders(request) },
        );
      }
    }

    const site =
      siteFromKey ||
      (await getOrCreateWebChatSite({
        channelId: channel!.id,
        botId: channel!.bot.id,
        tenantId: channel!.bot.tenantId,
        name: channel!.name,
        themeConfig: (channel!.config as Prisma.JsonObject | null) || {},
        metadata: {
          ...(parsed.data.metadata || {}),
          origin: inputOrigin || requestOrigin,
        },
      }));

    if (
      !isOriginAllowedForSite(
        site,
        inputOrigin || requestOrigin,
        requestReferer,
      )
    ) {
      return NextResponse.json(
        { error: "Origin not allowed for this site" },
        { status: 403, headers: createWebchatCorsHeaders(request) },
      );
    }

    const session = await resolveWebchatVisitorSession({
      siteId: site.id,
      botId: site.bot.id,
      tenantId: site.bot.tenantId,
      channelId: site.channelId || channel?.id,
      visitorId: parsed.data.visitorId,
      contact: parsed.data.visitorContext || parsed.data.contact,
      metadata: {
        ...(parsed.data.metadata || {}),
        origin: inputOrigin || requestOrigin,
        referer: requestReferer,
      },
    });

    const resolvedChannelId = site.channelId || channel?.id;
    if (!resolvedChannelId) {
      return NextResponse.json(
        { error: "Webchat channel is not configured for this site" },
        { status: 500, headers: createWebchatCorsHeaders(request) },
      );
    }

    await prisma.webChatEvent.create({
      data: {
        siteId: site.id,
        sessionId: session.webChatSession.id,
        type: "INIT",
        payload: {
          hasContact: Boolean(
            parsed.data.contact || parsed.data.visitorContext,
          ),
        },
      },
    });

    const token = createWebchatSessionToken({
      siteId: site.id,
      channelId: resolvedChannelId,
      botId: site.bot.id,
      tenantId: site.bot.tenantId,
      conversationId: session.conversation.id,
      visitorId: session.visitorId,
    });

    return NextResponse.json(
      {
        token,
        visitorId: session.visitorId,
        conversationId: session.conversation.id,
        webChatSessionId: session.webChatSession.id,
        channelId: site.channelId || channel?.id || null,
        botId: site.bot.id,
        siteId: site.id,
        publicKey: site.publicKey,
        config: (site.themeConfig as Prisma.JsonObject | null) || {},
        expiresIn: 60 * 60 * 24,
      },
      { headers: createWebchatCorsHeaders(request) },
    );
  } catch (error) {
    console.error("[Webchat Init] Failed to initialize session:", error);
    return NextResponse.json(
      { error: "Failed to initialize webchat" },
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
