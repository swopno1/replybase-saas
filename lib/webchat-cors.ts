import { NextRequest } from "next/server";

const DEFAULT_ALLOWED_HEADERS = "Content-Type, Authorization";
const DEFAULT_ALLOWED_METHODS = "GET, POST, OPTIONS";

function parseAllowedOrigins(): string[] {
  const value = process.env.WEBCHAT_ALLOWED_ORIGINS;
  if (!value) {
    return ["*"];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isWebchatOriginAllowed(request: NextRequest): boolean {
  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.includes("*")) {
    return true;
  }

  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) {
    // Non-browser or same-origin traffic
    return true;
  }

  return allowedOrigins.includes(requestOrigin);
}

export function getWebchatCorsOrigin(request: NextRequest): string {
  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.includes("*")) {
    return "*";
  }

  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) {
    return allowedOrigins[0] || "*";
  }

  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
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
