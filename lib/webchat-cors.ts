import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebchatSessionToken } from "@/lib/webchat-session";

const DEFAULT_ALLOWED_HEADERS = "Content-Type, Authorization";
const DEFAULT_ALLOWED_METHODS = "GET, POST, OPTIONS";

type WebchatOriginCheckResult = {
  allowed: boolean;
  reason?: string;
};

function normalizeOrigin(value?: string | null): string {
  if (!value) {
    return "";
  }

  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return "";
  }
}

function getRequestTargetOrigin(request: NextRequest): string {
  const nextUrlOrigin = normalizeOrigin(request.nextUrl?.origin);
  if (nextUrlOrigin) {
    return nextUrlOrigin;
  }

  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) {
    return "";
  }

  const proto = request.headers.get("x-forwarded-proto") || "https";
  return normalizeOrigin(`${proto}://${host}`);
}

function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

function allowWildcardInProduction() {
  return process.env.WEBCHAT_ALLOW_WILDCARD_IN_PRODUCTION === "true";
}

function requireRefererOrOrigin() {
  if (process.env.WEBCHAT_REQUIRE_ORIGIN_OR_REFERER === "false") {
    return false;
  }

  return isProductionEnvironment();
}

function requireMatchingOriginAndReferer() {
  if (process.env.WEBCHAT_STRICT_ORIGIN_REFERER_MATCH === "false") {
    return false;
  }

  return true;
}

function parseAllowedOrigins(): string[] {
  const value = process.env.WEBCHAT_ALLOWED_ORIGINS;
  if (!value) {
    return isProductionEnvironment() ? [] : ["*"];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map((origin) => (origin === "*" ? "*" : normalizeOrigin(origin))),
    ),
  );
}

function isOriginAllowedForWebChatSite(
  allowedDomains: unknown,
  origin?: string | null,
  referer?: string | null,
): boolean {
  if (!allowedDomains || !Array.isArray(allowedDomains)) {
    return true;
  }

  const allowlist = allowedDomains
    .filter((entry): entry is string => typeof entry === "string")
    .map((val) => normalizeOrigin(val))
    .filter(Boolean);

  if (allowlist.length === 0) {
    return true;
  }

  const normalizedOrigin = origin ? normalizeOrigin(origin) : "";
  const normalizedRefererOrigin = referer ? normalizeOrigin(referer) : "";

  if (normalizedOrigin && allowlist.includes(normalizedOrigin)) {
    return true;
  }

  if (normalizedRefererOrigin && allowlist.includes(normalizedRefererOrigin)) {
    return true;
  }

  return false;
}

async function checkWebchatOrigin(request: NextRequest): Promise<WebchatOriginCheckResult> {
  const allowedOrigins = parseAllowedOrigins();
  const requestOrigin = normalizeOrigin(request.headers.get("origin"));
  const requestRefererOrigin = normalizeOrigin(request.headers.get("referer"));
  const requestTargetOrigin = getRequestTargetOrigin(request);

  if (
    requireMatchingOriginAndReferer() &&
    requestOrigin &&
    requestRefererOrigin
  ) {
    if (requestOrigin !== requestRefererOrigin) {
      return {
        allowed: false,
        reason: "Origin and Referer origin mismatch",
      };
    }
  }

  if (requireRefererOrOrigin() && !requestOrigin && !requestRefererOrigin) {
    return {
      allowed: false,
      reason: "Origin or Referer header is required",
    };
  }

  // Same-origin bypass (important for dashboard test widget & local debug)
  if (
    requestTargetOrigin &&
    ((requestOrigin && requestOrigin === requestTargetOrigin) ||
      (requestRefererOrigin && requestRefererOrigin === requestTargetOrigin))
  ) {
    const resolvedOrigin = requestOrigin || requestRefererOrigin || requestTargetOrigin;
    (request as any)._resolvedWebchatCorsOrigin = resolvedOrigin;
    return { allowed: true };
  }

  // Global WEBCHAT_ALLOWED_ORIGINS configuration (if set by admins)
  const hasGlobalConfig = process.env.WEBCHAT_ALLOWED_ORIGINS !== undefined;
  if (hasGlobalConfig) {
    if (allowedOrigins.includes("*")) {
      if (isProductionEnvironment() && !allowWildcardInProduction()) {
        return {
          allowed: false,
          reason:
            "Wildcard origin is blocked in production. Configure WEBCHAT_ALLOWED_ORIGINS explicitly.",
        };
      }
    } else {
      let allowedGlobally = false;
      if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
        allowedGlobally = true;
      }
      if (requestRefererOrigin && allowedOrigins.includes(requestRefererOrigin)) {
        allowedGlobally = true;
      }
      if (!allowedGlobally) {
        return {
          allowed: false,
          reason: "Origin not in WEBCHAT_ALLOWED_ORIGINS",
        };
      }
    }
  }

  // Retrieve site context parameters
  let searchParams: URLSearchParams | null = null;
  if (request.nextUrl) {
    searchParams = request.nextUrl.searchParams;
  } else if (request.url) {
    try {
      searchParams = new URL(request.url).searchParams;
    } catch {
      // Ignore
    }
  }

  let publicKey = searchParams?.get("publicKey") || undefined;
  let siteId = searchParams?.get("siteId") || undefined;
  let token = searchParams?.get("token") || undefined;
  let botId = searchParams?.get("botId") || undefined;
  let channelId = searchParams?.get("channelId") || undefined;

  if (request.method === "POST" || request.method === "PUT") {
    try {
      const cloned = request.clone();
      const body = await cloned.json();
      if (body) {
        if (typeof body.publicKey === "string") publicKey = body.publicKey;
        if (typeof body.token === "string") token = body.token;
        if (typeof body.botId === "string") botId = body.botId;
        if (typeof body.channelId === "string") channelId = body.channelId;
        if (typeof body.siteId === "string") siteId = body.siteId;
      }
    } catch {
      // Ignore body parsing failures
    }
  }

  let site: { allowedDomains: any } | null = null;

  if (siteId) {
    site = await prisma.webChatSite.findFirst({
      where: { id: siteId, isActive: true },
      select: { allowedDomains: true },
    });
  } else if (publicKey) {
    site = await prisma.webChatSite.findFirst({
      where: { publicKey, isActive: true },
      select: { allowedDomains: true },
    });
  } else if (token) {
    try {
      const session = verifyWebchatSessionToken(token);
      if (session.siteId) {
        site = await prisma.webChatSite.findFirst({
          where: { id: session.siteId, isActive: true },
          select: { allowedDomains: true },
        });
      } else if (session.channelId || session.botId) {
        site = await prisma.webChatSite.findFirst({
          where: {
            channelId: session.channelId || undefined,
            botId: session.botId || undefined,
            isActive: true,
          },
          select: { allowedDomains: true },
        });
      }
    } catch {
      // Ignore token verification errors (actual route handlers will validate tokens)
    }
  } else if (botId || channelId) {
    site = await prisma.webChatSite.findFirst({
      where: {
        channelId: channelId || undefined,
        botId: botId || undefined,
        isActive: true,
      },
      select: { allowedDomains: true },
    });
  }

  if (site) {
    const originAllowed = isOriginAllowedForWebChatSite(
      site.allowedDomains,
      requestOrigin,
      requestRefererOrigin,
    );
    if (!originAllowed) {
      return {
        allowed: false,
        reason: "Origin not allowed by site configuration",
      };
    }
  }

  let resolvedOrigin = requestOrigin || requestRefererOrigin || requestTargetOrigin || "";
  if (allowedOrigins.includes("*") && (!isProductionEnvironment() || allowWildcardInProduction())) {
    resolvedOrigin = "*";
  }
  (request as any)._resolvedWebchatCorsOrigin = resolvedOrigin;

  return { allowed: true };
}

export async function isWebchatOriginAllowed(request: NextRequest): Promise<boolean> {
  const result = await checkWebchatOrigin(request);
  return result.allowed;
}

export async function getWebchatOriginRejectionReason(
  request: NextRequest,
): Promise<string | null> {
  const result = await checkWebchatOrigin(request);
  return result.allowed ? null : result.reason || "Origin not allowed";
}

export function getWebchatCorsOrigin(request: NextRequest): string {
  if ((request as any)._resolvedWebchatCorsOrigin !== undefined) {
    return (request as any)._resolvedWebchatCorsOrigin;
  }

  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.includes("*")) {
    if (isProductionEnvironment() && !allowWildcardInProduction()) {
      return "";
    }

    return "*";
  }

  const requestOrigin = normalizeOrigin(request.headers.get("origin"));
  const requestRefererOrigin = normalizeOrigin(request.headers.get("referer"));
  const requestTargetOrigin = getRequestTargetOrigin(request);

  if (
    requestTargetOrigin &&
    ((requestOrigin && requestOrigin === requestTargetOrigin) ||
      (requestRefererOrigin && requestRefererOrigin === requestTargetOrigin))
  ) {
    return requestOrigin || requestRefererOrigin || requestTargetOrigin;
  }

  if (!allowedOrigins.length) {
    return requestOrigin || requestRefererOrigin || requestTargetOrigin || "";
  }

  if (!requestOrigin) {
    return requestRefererOrigin || allowedOrigins[0] || "";
  }

  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  if (requestRefererOrigin && allowedOrigins.includes(requestRefererOrigin)) {
    return requestRefererOrigin;
  }

  return "";
}

export function createWebchatCorsHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  const allowedOrigin = getWebchatCorsOrigin(request);

  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
  headers.set("Access-Control-Allow-Methods", DEFAULT_ALLOWED_METHODS);
  headers.set("Access-Control-Allow-Headers", DEFAULT_ALLOWED_HEADERS);
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");

  return headers;
}
