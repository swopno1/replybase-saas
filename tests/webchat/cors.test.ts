import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  isWebchatOriginAllowed,
  getWebchatOriginRejectionReason,
  getWebchatCorsOrigin,
} from "@/lib/webchat-cors";

// Minimal NextRequest mock for the CORS helpers
function makeReq(
  headers: Record<string, string> = {},
  url: string = "https://api.replybase.test/api/webchat/init",
): NextRequest {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    normalized[k.toLowerCase()] = v;
  }
  return {
    headers: {
      get: (name: string) => normalized[name.toLowerCase()] ?? null,
    },
    nextUrl: new URL(url),
    url,
  } as unknown as NextRequest;
}

describe("webchat CORS origin checks", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      NODE_ENV: process.env.NODE_ENV,
      WEBCHAT_ALLOWED_ORIGINS: process.env.WEBCHAT_ALLOWED_ORIGINS,
      WEBCHAT_ALLOW_WILDCARD_IN_PRODUCTION:
        process.env.WEBCHAT_ALLOW_WILDCARD_IN_PRODUCTION,
      WEBCHAT_REQUIRE_ORIGIN_OR_REFERER:
        process.env.WEBCHAT_REQUIRE_ORIGIN_OR_REFERER,
      WEBCHAT_STRICT_ORIGIN_REFERER_MATCH:
        process.env.WEBCHAT_STRICT_ORIGIN_REFERER_MATCH,
    };
    delete process.env.WEBCHAT_ALLOWED_ORIGINS;
    delete process.env.WEBCHAT_ALLOW_WILDCARD_IN_PRODUCTION;
    delete process.env.WEBCHAT_REQUIRE_ORIGIN_OR_REFERER;
    delete process.env.WEBCHAT_STRICT_ORIGIN_REFERER_MATCH;
    // default to development for most tests
    (process.env as Record<string, string>).NODE_ENV = "test";
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        (process.env as Record<string, string>)[k] = v;
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Development defaults
  // ---------------------------------------------------------------------------
  describe("development / non-production defaults", () => {
    it("allows any origin when no WEBCHAT_ALLOWED_ORIGINS set (wildcard default)", () => {
      const req = makeReq({ origin: "https://example.com" });
      expect(isWebchatOriginAllowed(req)).toBe(true);
    });

    it("allows request with no origin header (wildcard path, no requireRefererOrOrigin)", () => {
      const req = makeReq();
      expect(isWebchatOriginAllowed(req)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Production defaults
  // ---------------------------------------------------------------------------
  describe("production mode", () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = "production";
    });

    it("blocks all origins when WEBCHAT_ALLOWED_ORIGINS is not configured", () => {
      const req = makeReq({ origin: "https://example.com" });
      expect(isWebchatOriginAllowed(req)).toBe(false);
      expect(getWebchatOriginRejectionReason(req)).toBe(
        "No webchat origins configured",
      );
    });

    it("allows same-origin dashboard requests even when WEBCHAT_ALLOWED_ORIGINS is not configured", () => {
      const req = makeReq(
        {
          origin: "https://app.replybase.co.uk",
          referer: "https://app.replybase.co.uk/integrations/webchat/test",
        },
        "https://app.replybase.co.uk/api/webchat/init",
      );

      expect(isWebchatOriginAllowed(req)).toBe(true);
      expect(getWebchatOriginRejectionReason(req)).toBeNull();
    });

    it("blocks wildcard in WEBCHAT_ALLOWED_ORIGINS without explicit override", () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "*";
      const req = makeReq({ origin: "https://example.com" });
      expect(isWebchatOriginAllowed(req)).toBe(false);
      expect(getWebchatOriginRejectionReason(req)).toContain(
        "Wildcard origin is blocked in production",
      );
    });

    it("allows wildcard when WEBCHAT_ALLOW_WILDCARD_IN_PRODUCTION=true", () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "*";
      process.env.WEBCHAT_ALLOW_WILDCARD_IN_PRODUCTION = "true";
      const req = makeReq({ origin: "https://example.com" });
      expect(isWebchatOriginAllowed(req)).toBe(true);
    });

    it("blocks request missing both Origin and Referer headers", () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq(); // no origin, no referer
      expect(isWebchatOriginAllowed(req)).toBe(false);
      expect(getWebchatOriginRejectionReason(req)).toBe(
        "Origin or Referer header is required",
      );
    });

    it("disabling WEBCHAT_REQUIRE_ORIGIN_OR_REFERER allows headerless request", () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      process.env.WEBCHAT_REQUIRE_ORIGIN_OR_REFERER = "false";
      const req = makeReq();
      // no origin or referer, but requirement disabled → no match in allowlist → denied by another reason
      const reason = getWebchatOriginRejectionReason(req);
      expect(reason).not.toBe("Origin or Referer header is required");
    });
  });

  // ---------------------------------------------------------------------------
  // Allowlist matching
  // ---------------------------------------------------------------------------
  describe("WEBCHAT_ALLOWED_ORIGINS allowlist", () => {
    it("allows exact origin match", () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({ origin: "https://example.com" });
      expect(isWebchatOriginAllowed(req)).toBe(true);
    });

    it("allows case-insensitive origin match", () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({ origin: "HTTPS://EXAMPLE.COM" });
      expect(isWebchatOriginAllowed(req)).toBe(true);
    });

    it("denies origin not in allowlist", () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({ origin: "https://evil.com" });
      expect(isWebchatOriginAllowed(req)).toBe(false);
      expect(getWebchatOriginRejectionReason(req)).toBe(
        "Origin not in WEBCHAT_ALLOWED_ORIGINS",
      );
    });

    it("allows multiple comma-separated origins", () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://foo.com, https://bar.com";
      expect(
        isWebchatOriginAllowed(makeReq({ origin: "https://foo.com" })),
      ).toBe(true);
      expect(
        isWebchatOriginAllowed(makeReq({ origin: "https://bar.com" })),
      ).toBe(true);
      expect(
        isWebchatOriginAllowed(makeReq({ origin: "https://baz.com" })),
      ).toBe(false);
    });

    it("allows when only Referer is present and its origin is in allowlist", () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({
        referer: "https://example.com/page?q=1",
        // no Origin header
      });
      expect(isWebchatOriginAllowed(req)).toBe(true);
    });

    it("returns null from getWebchatOriginRejectionReason when origin is allowed", () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({ origin: "https://example.com" });
      expect(getWebchatOriginRejectionReason(req)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Origin / Referer mismatch
  // ---------------------------------------------------------------------------
  describe("Origin and Referer mismatch", () => {
    it("blocks when Origin and Referer have different origins", () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({
        origin: "https://example.com",
        referer: "https://different.com/page",
      });
      expect(isWebchatOriginAllowed(req)).toBe(false);
      expect(getWebchatOriginRejectionReason(req)).toBe(
        "Origin and Referer origin mismatch",
      );
    });

    it("allows when Origin and Referer share the same origin", () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({
        origin: "https://example.com",
        referer: "https://example.com/some/path",
      });
      expect(isWebchatOriginAllowed(req)).toBe(true);
    });

    it("skips mismatch check when WEBCHAT_STRICT_ORIGIN_REFERER_MATCH=false", () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      process.env.WEBCHAT_STRICT_ORIGIN_REFERER_MATCH = "false";
      const req = makeReq({
        origin: "https://example.com",
        referer: "https://totally-different.com/page",
      });
      expect(isWebchatOriginAllowed(req)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // getWebchatCorsOrigin
  // ---------------------------------------------------------------------------
  describe("getWebchatCorsOrigin", () => {
    it("returns * in dev/wildcard mode", () => {
      // wildcard default in non-prod
      const req = makeReq({ origin: "https://example.com" });
      expect(getWebchatCorsOrigin(req)).toBe("*");
    });

    it("returns the matching allowed origin", () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({ origin: "https://example.com" });
      expect(getWebchatCorsOrigin(req)).toBe("https://example.com");
    });

    it("returns the same origin for dashboard-controlled same-origin requests in production", () => {
      (process.env as Record<string, string>).NODE_ENV = "production";
      delete process.env.WEBCHAT_ALLOWED_ORIGINS;
      const req = makeReq(
        {
          origin: "https://app.replybase.co.uk",
          referer: "https://app.replybase.co.uk/integrations/webchat/test",
        },
        "https://app.replybase.co.uk/api/webchat/init",
      );
      expect(getWebchatCorsOrigin(req)).toBe("https://app.replybase.co.uk");
    });

    it("returns empty string when origin is not allowed", () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({ origin: "https://evil.com" });
      expect(getWebchatCorsOrigin(req)).toBe("");
    });
  });
});
