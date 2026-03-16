import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  findActiveWebChannel,
  findActiveWebChatSite,
  getOrCreateWebChatSite,
  isOriginAllowedForSite,
} from "@/lib/webchat";
import {
  createWebchatCorsHeaders,
  isWebchatOriginAllowed,
} from "@/lib/webchat-cors";

export async function GET(request: NextRequest) {
  try {
    if (!isWebchatOriginAllowed(request)) {
      return NextResponse.json(
        { error: "Origin not allowed" },
        { status: 403, headers: createWebchatCorsHeaders(request) },
      );
    }

    const publicKey =
      request.nextUrl.searchParams.get("publicKey") || undefined;
    const channelId =
      request.nextUrl.searchParams.get("channelId") || undefined;
    const botId = request.nextUrl.searchParams.get("botId") || undefined;

    if (!publicKey && !channelId && !botId) {
      return NextResponse.json(
        { error: "Provide publicKey, channelId, or botId" },
        { status: 400, headers: createWebchatCorsHeaders(request) },
      );
    }

    const requestOrigin = request.headers.get("origin") || undefined;
    const requestReferer = request.headers.get("referer") || undefined;

    const siteFromKey = publicKey
      ? await findActiveWebChatSite({ publicKey })
      : null;

    if (siteFromKey) {
      if (!isOriginAllowedForSite(siteFromKey, requestOrigin, requestReferer)) {
        return NextResponse.json(
          { error: "Origin not allowed for this site" },
          { status: 403, headers: createWebchatCorsHeaders(request) },
        );
      }

      return NextResponse.json(
        {
          channelId: siteFromKey.channelId,
          botId: siteFromKey.bot.id,
          siteId: siteFromKey.id,
          publicKey: siteFromKey.publicKey,
          config: (siteFromKey.themeConfig as Prisma.JsonObject | null) || {},
        },
        { headers: createWebchatCorsHeaders(request) },
      );
    }

    const channel = await findActiveWebChannel({ channelId, botId });
    if (!channel?.bot) {
      return NextResponse.json(
        { error: "Active web channel not found" },
        { status: 404, headers: createWebchatCorsHeaders(request) },
      );
    }

    const site = await getOrCreateWebChatSite({
      channelId: channel.id,
      botId: channel.bot.id,
      tenantId: channel.bot.tenantId,
      name: channel.name,
      themeConfig: (channel.config as Prisma.JsonObject | null) || {},
      metadata: {
        origin: requestOrigin,
      },
    });

    if (!isOriginAllowedForSite(site, requestOrigin, requestReferer)) {
      return NextResponse.json(
        { error: "Origin not allowed for this site" },
        { status: 403, headers: createWebchatCorsHeaders(request) },
      );
    }

    const config = (site.themeConfig as Prisma.JsonObject | null) || {};

    return NextResponse.json(
      {
        channelId: channel.id,
        botId: channel.bot.id,
        siteId: site.id,
        publicKey: site.publicKey,
        config,
      },
      { headers: createWebchatCorsHeaders(request) },
    );
  } catch (error) {
    console.error("[Webchat Config] Failed to load config:", error);
    return NextResponse.json(
      { error: "Failed to load webchat config" },
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
