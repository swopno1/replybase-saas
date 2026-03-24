import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * API Key authentication for external services (e.g., marketing site)
 *
 * This allows the marketing site (replybase.co.uk) to securely access
 * specific APIs like newsletter subscription and data deletion requests.
 */

const API_SECRET_KEY = process.env.API_SECRET_KEY;

function isTimingSafeMatch(candidate: string, secret: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const secretBuffer = Buffer.from(secret);

  if (candidateBuffer.length !== secretBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, secretBuffer);
}

export interface ApiAuthResult {
  authenticated: boolean;
  source: "api-key" | "session" | "none";
  error?: string;
}

/**
 * Validates API key from request headers
 * Supports both Authorization header and x-api-key header
 */
export function validateApiKey(request: NextRequest): ApiAuthResult {
  if (!API_SECRET_KEY) {
    console.warn("[API Auth] API_SECRET_KEY not configured");
    return {
      authenticated: false,
      source: "none",
      error: "API authentication not configured",
    };
  }

  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (isTimingSafeMatch(token, API_SECRET_KEY)) {
      return {
        authenticated: true,
        source: "api-key",
      };
    }
  }

  // Check x-api-key header (alternative format)
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader && isTimingSafeMatch(apiKeyHeader, API_SECRET_KEY)) {
    return {
      authenticated: true,
      source: "api-key",
    };
  }

  return {
    authenticated: false,
    source: "none",
    error: "Invalid or missing API key",
  };
}

/**
 * Checks if request is authenticated either via API key or user session
 * This allows endpoints to work for both marketing site (API key) and logged-in users (session)
 */
export function isAuthenticatedRequest(
  apiAuth: ApiAuthResult,
  hasSession: boolean,
): boolean {
  return apiAuth.authenticated || hasSession;
}
