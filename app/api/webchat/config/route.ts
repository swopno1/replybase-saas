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
  getWebchatOriginRejectionReason,
  isWebchatOriginAllowed,
} from "@/lib/webchat-cors";
import { recordWebchatErrorEvent } from "@/lib/webchat-diagnostics";
import { createWebchatInitChallenge } from "@/lib/webchat-init-challenge";
import { getWebchatTelemetryConfig } from "@/lib/webchat-telemetry";
import { getWebchatRolloutDecision } from "@/lib/webchat-rollout";

export const dynamic = 'force-dynamic';




export async function GET(request: NextRequest) {
  try {
    if (!(await isWebchatOriginAllowed(request))) {
      const reason = await getWebchatOriginRejectionReason(request);
      return NextResponse.json(
        { error: "Origin not allowed", reason },
        { status: 403, headers: createWebchatCorsHeaders(request) },
      );
    }

    const publicKey =
      request.nextUrl.searchParams.get("publicKey") || undefined;
    const channelId =
      request.nextUrl.searchParams.get("channelId") || undefined;
    const botId = request.nextUrl.searchParams.get("botId") || undefined;
    const siteId = request.nextUrl.searchParams.get("siteId") || undefined;

    if (!publicKey && !channelId && !botId && !siteId) {
      return NextResponse.json(
        { error: "Provide siteId, publicKey, channelId, or botId" },
        { status: 400, headers: createWebchatCorsHeaders(request) },
      );
    }

    const requestOrigin = request.headers.get("origin") || undefined;
    const requestReferer = request.headers.get("referer") || undefined;

    const siteFromKey = siteId 
      ? await findActiveWebChatSite({ id: siteId })
      : publicKey
        ? await findActiveWebChatSite({ publicKey })
        : null;

    if (siteFromKey) {
      const rollout = await getWebchatRolloutDecision(siteFromKey.bot.tenantId);
      if (!rollout.allowed) {
        return NextResponse.json(
          {
            error: "Webchat is not enabled for this tenant",
            reason: rollout.reason,
          },
          { status: 403, headers: createWebchatCorsHeaders(request) },
        );
      }

      if (!isOriginAllowedForSite(siteFromKey, requestOrigin, requestReferer)) {
        await recordWebchatErrorEvent({
          siteId: siteFromKey.id,
          reason: "blocked_origin",
          stage: "config",
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

      return NextResponse.json(
        {
          channelId: siteFromKey.channelId,
          botId: siteFromKey.bot.id,
          siteId: siteFromKey.id,
          publicKey: siteFromKey.publicKey,
          initChallenge: createWebchatInitChallenge({
            siteId: siteFromKey.id,
            publicKey: siteFromKey.publicKey,
            origin: requestOrigin || requestReferer,
          }),
          telemetry: getWebchatTelemetryConfig(),
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

    const rollout = await getWebchatRolloutDecision(channel.bot.tenantId);
    if (!rollout.allowed) {
      return NextResponse.json(
        {
          error: "Webchat is not enabled for this tenant",
          reason: rollout.reason,
        },
        { status: 403, headers: createWebchatCorsHeaders(request) },
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
      await recordWebchatErrorEvent({
        siteId: site.id,
        reason: "blocked_origin",
        stage: "config",
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

    const config = (site.themeConfig as Prisma.JsonObject | null) || {};

    return NextResponse.json(
      {
        channelId: channel.id,
        botId: channel.bot.id,
        siteId: site.id,
        publicKey: site.publicKey,
        initChallenge: createWebchatInitChallenge({
          siteId: site.id,
          publicKey: site.publicKey,
          origin: requestOrigin || requestReferer,
        }),
        telemetry: getWebchatTelemetryConfig(),
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
  if (!(await isWebchatOriginAllowed(request))) {
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
