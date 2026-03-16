import { NextRequest } from "next/server";

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

function checkWebchatOrigin(request: NextRequest): WebchatOriginCheckResult {
  const allowedOrigins = parseAllowedOrigins();
  const requestOrigin = normalizeOrigin(request.headers.get("origin"));
  const requestRefererOrigin = normalizeOrigin(request.headers.get("referer"));

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

  if (allowedOrigins.includes("*")) {
    if (isProductionEnvironment() && !allowWildcardInProduction()) {
      return {
        allowed: false,
        reason:
          "Wildcard origin is blocked in production. Configure WEBCHAT_ALLOWED_ORIGINS explicitly.",
      };
    }

    return { allowed: true };
  }

  if (!allowedOrigins.length) {
    return {
      allowed: false,
      reason: "No webchat origins configured",
    };
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return { allowed: true };
  }

  if (requestRefererOrigin && allowedOrigins.includes(requestRefererOrigin)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "Origin not in WEBCHAT_ALLOWED_ORIGINS",
  };
}

export function isWebchatOriginAllowed(request: NextRequest): boolean {
  return checkWebchatOrigin(request).allowed;
}

export function getWebchatOriginRejectionReason(
  request: NextRequest,
): string | null {
  const result = checkWebchatOrigin(request);
  return result.allowed ? null : result.reason || "Origin not allowed";
}

export function getWebchatCorsOrigin(request: NextRequest): string {
  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.includes("*")) {
    if (isProductionEnvironment() && !allowWildcardInProduction()) {
      return "";
    }

    return "*";
  }

  const requestOrigin = normalizeOrigin(request.headers.get("origin"));
  const requestRefererOrigin = normalizeOrigin(request.headers.get("referer"));

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
