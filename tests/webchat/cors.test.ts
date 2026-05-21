import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock } from "../mocks/prisma";

// Mock the prisma import so the singleton uses prismaMock
vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import {
  isWebchatOriginAllowed,
  getWebchatOriginRejectionReason,
  getWebchatCorsOrigin,
} from "@/lib/webchat-cors";
import { createWebchatSessionToken } from "@/lib/webchat-session";

// Mock NextRequest for CORS testing
function makeReq(
  headers: Record<string, string> = {},
  url: string = "https://api.replybase.test/api/webchat/init",
  method: string = "GET",
  body?: any,
): NextRequest {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    normalized[k.toLowerCase()] = v;
  }
  const req = {
    headers: {
      get: (name: string) => normalized[name.toLowerCase()] ?? null,
    },
    nextUrl: new URL(url),
    url,
    method,
    clone: () => req,
    json: async () => body,
  } as unknown as NextRequest;
  return req;
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
      WEBCHAT_TOKEN_SECRET: process.env.WEBCHAT_TOKEN_SECRET,
    };
    delete process.env.WEBCHAT_ALLOWED_ORIGINS;
    delete process.env.WEBCHAT_ALLOW_WILDCARD_IN_PRODUCTION;
    delete process.env.WEBCHAT_REQUIRE_ORIGIN_OR_REFERER;
    delete process.env.WEBCHAT_STRICT_ORIGIN_REFERER_MATCH;
    // default to development/test environment
    (process.env as Record<string, string>).NODE_ENV = "test";
    (process.env as Record<string, string>).WEBCHAT_TOKEN_SECRET = "test-secret-key-123456";
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
    it("allows any origin when no WEBCHAT_ALLOWED_ORIGINS set (wildcard default)", async () => {
      const req = makeReq({ origin: "https://example.com" });
      expect(await isWebchatOriginAllowed(req)).toBe(true);
    });

    it("allows request with no origin header (wildcard path, no requireRefererOrOrigin)", async () => {
      const req = makeReq();
      expect(await isWebchatOriginAllowed(req)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Production defaults
  // ---------------------------------------------------------------------------
  describe("production mode", () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = "production";
    });

    it("allows requests when WEBCHAT_ALLOWED_ORIGINS is not configured so the site allowlist can decide dynamically", async () => {
      const req = makeReq({ origin: "https://example.com" });
      expect(await isWebchatOriginAllowed(req)).toBe(true);
      expect(await getWebchatOriginRejectionReason(req)).toBeNull();
    });

    it("allows same-origin dashboard requests even when WEBCHAT_ALLOWED_ORIGINS is not configured", async () => {
      const req = makeReq(
        {
          origin: "https://app.replybase.co.uk",
          referer: "https://app.replybase.co.uk/integrations/webchat/test",
        },
        "https://app.replybase.co.uk/api/webchat/init",
      );

      expect(await isWebchatOriginAllowed(req)).toBe(true);
      expect(await getWebchatOriginRejectionReason(req)).toBeNull();
    });

    it("blocks wildcard in WEBCHAT_ALLOWED_ORIGINS without explicit override", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "*";
      const req = makeReq({ origin: "https://example.com" });
      expect(await isWebchatOriginAllowed(req)).toBe(false);
      expect(await getWebchatOriginRejectionReason(req)).toContain(
        "Wildcard origin is blocked in production",
      );
    });

    it("allows wildcard when WEBCHAT_ALLOW_WILDCARD_IN_PRODUCTION=true", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "*";
      process.env.WEBCHAT_ALLOW_WILDCARD_IN_PRODUCTION = "true";
      const req = makeReq({ origin: "https://example.com" });
      expect(await isWebchatOriginAllowed(req)).toBe(true);
    });

    it("blocks request missing both Origin and Referer headers", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq(); // no origin, no referer
      expect(await isWebchatOriginAllowed(req)).toBe(false);
      expect(await getWebchatOriginRejectionReason(req)).toBe(
        "Origin or Referer header is required",
      );
    });

    it("disabling WEBCHAT_REQUIRE_ORIGIN_OR_REFERER allows headerless request", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      process.env.WEBCHAT_REQUIRE_ORIGIN_OR_REFERER = "false";
      const req = makeReq();
      // no origin or referer, but requirement disabled → no match in allowlist → denied by another reason
      const reason = await getWebchatOriginRejectionReason(req);
      expect(reason).not.toBe("Origin or Referer header is required");
    });
  });

  // ---------------------------------------------------------------------------
  // Allowlist matching
  // ---------------------------------------------------------------------------
  describe("WEBCHAT_ALLOWED_ORIGINS allowlist", () => {
    it("allows exact origin match", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({ origin: "https://example.com" });
      expect(await isWebchatOriginAllowed(req)).toBe(true);
    });

    it("allows case-insensitive origin match", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({ origin: "HTTPS://EXAMPLE.COM" });
      expect(await isWebchatOriginAllowed(req)).toBe(true);
    });

    it("denies origin not in allowlist", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({ origin: "https://evil.com" });
      expect(await isWebchatOriginAllowed(req)).toBe(false);
      expect(await getWebchatOriginRejectionReason(req)).toBe(
        "Origin not in WEBCHAT_ALLOWED_ORIGINS",
      );
    });

    it("allows multiple comma-separated origins", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://foo.com, https://bar.com";
      expect(
        await isWebchatOriginAllowed(makeReq({ origin: "https://foo.com" })),
      ).toBe(true);
      expect(
        await isWebchatOriginAllowed(makeReq({ origin: "https://bar.com" })),
      ).toBe(true);
      expect(
        await isWebchatOriginAllowed(makeReq({ origin: "https://baz.com" })),
      ).toBe(false);
    });

    it("allows when only Referer is present and its origin is in allowlist", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({
        referer: "https://example.com/page?q=1",
        // no Origin header
      });
      expect(await isWebchatOriginAllowed(req)).toBe(true);
    });

    it("returns null from getWebchatOriginRejectionReason when origin is allowed", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({ origin: "https://example.com" });
      expect(await getWebchatOriginRejectionReason(req)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Origin / Referer mismatch
  // ---------------------------------------------------------------------------
  describe("Origin and Referer mismatch", () => {
    it("blocks when Origin and Referer have different origins", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({
        origin: "https://example.com",
        referer: "https://different.com/page",
      });
      expect(await isWebchatOriginAllowed(req)).toBe(false);
      expect(await getWebchatOriginRejectionReason(req)).toBe(
        "Origin and Referer origin mismatch",
      );
    });

    it("allows when Origin and Referer share the same origin", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({
        origin: "https://example.com",
        referer: "https://example.com/some/path",
      });
      expect(await isWebchatOriginAllowed(req)).toBe(true);
    });

    it("skips mismatch check when WEBCHAT_STRICT_ORIGIN_REFERER_MATCH=false", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      process.env.WEBCHAT_STRICT_ORIGIN_REFERER_MATCH = "false";
      const req = makeReq({
        origin: "https://example.com",
        referer: "https://totally-different.com/page",
      });
      expect(await isWebchatOriginAllowed(req)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Dynamic Allowed Domains from Site Config
  // ---------------------------------------------------------------------------
  describe("Dynamic Allowed Domains checking", () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = "production";
    });

    it("allows any origin if allowedDomains is not configured on the site", async () => {
      prismaMock.webChatSite.findFirst.mockResolvedValue({
        id: "site-1",
        allowedDomains: null,
      } as any);

      const req = makeReq({ origin: "https://external.com" }, "https://api.replybase.test/api/webchat/config?siteId=site-1");
      expect(await isWebchatOriginAllowed(req)).toBe(true);
    });

    it("allows any origin if allowedDomains is an empty list", async () => {
      prismaMock.webChatSite.findFirst.mockResolvedValue({
        id: "site-1",
        allowedDomains: [],
      } as any);

      const req = makeReq({ origin: "https://external.com" }, "https://api.replybase.test/api/webchat/config?siteId=site-1");
      expect(await isWebchatOriginAllowed(req)).toBe(true);
    });

    it("allows configured domains in allowedDomains", async () => {
      prismaMock.webChatSite.findFirst.mockResolvedValue({
        id: "site-1",
        allowedDomains: ["https://mysite.com", "https://anothersite.com"],
      } as any);

      const reqAllowed = makeReq({ origin: "https://mysite.com" }, "https://api.replybase.test/api/webchat/config?siteId=site-1");
      expect(await isWebchatOriginAllowed(reqAllowed)).toBe(true);

      const reqDenied = makeReq({ origin: "https://evil.com" }, "https://api.replybase.test/api/webchat/config?siteId=site-1");
      expect(await isWebchatOriginAllowed(reqDenied)).toBe(false);
      expect(await getWebchatOriginRejectionReason(reqDenied)).toBe("Origin not allowed by site configuration");
    });

    it("resolves site using publicKey parameter", async () => {
      prismaMock.webChatSite.findFirst.mockResolvedValue({
        id: "site-1",
        allowedDomains: ["https://mysite.com"],
      } as any);

      const req = makeReq({ origin: "https://mysite.com" }, "https://api.replybase.test/api/webchat/config?publicKey=pub-key-1");
      expect(await isWebchatOriginAllowed(req)).toBe(true);
      expect(prismaMock.webChatSite.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ publicKey: "pub-key-1", isActive: true }),
      }));
    });

    it("resolves site using token parameter", async () => {
      const token = createWebchatSessionToken({
        siteId: "site-token-1",
        channelId: "channel-1",
        botId: "bot-1",
        tenantId: "tenant-1",
        conversationId: "conv-1",
        visitorId: "vis-1",
      });

      prismaMock.webChatSite.findFirst.mockResolvedValue({
        id: "site-token-1",
        allowedDomains: ["https://mysite.com"],
      } as any);

      const req = makeReq({ origin: "https://mysite.com" }, `https://api.replybase.test/api/webchat/message?token=${token}`);
      expect(await isWebchatOriginAllowed(req)).toBe(true);
      expect(prismaMock.webChatSite.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: "site-token-1", isActive: true }),
      }));
    });

    it("resolves site using POST body fields", async () => {
      prismaMock.webChatSite.findFirst.mockResolvedValue({
        id: "site-body-1",
        allowedDomains: ["https://mysite.com"],
      } as any);

      const req = makeReq(
        { origin: "https://mysite.com", "content-type": "application/json" },
        "https://api.replybase.test/api/webchat/config",
        "POST",
        { siteId: "site-body-1" }
      );
      expect(await isWebchatOriginAllowed(req)).toBe(true);
      expect(prismaMock.webChatSite.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: "site-body-1", isActive: true }),
      }));
    });
  });

  // ---------------------------------------------------------------------------
  // getWebchatCorsOrigin
  // ---------------------------------------------------------------------------
  describe("getWebchatCorsOrigin", () => {
    it("returns * in dev/wildcard mode", async () => {
      // wildcard default in non-prod
      const req = makeReq({ origin: "https://example.com" });
      // Call isWebchatOriginAllowed first to populate the cache
      await isWebchatOriginAllowed(req);
      expect(getWebchatCorsOrigin(req)).toBe("*");
    });

    it("returns the matching allowed origin", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({ origin: "https://example.com" });
      await isWebchatOriginAllowed(req);
      expect(getWebchatCorsOrigin(req)).toBe("https://example.com");
    });

    it("returns the same origin for dashboard-controlled same-origin requests in production", async () => {
      (process.env as Record<string, string>).NODE_ENV = "production";
      delete process.env.WEBCHAT_ALLOWED_ORIGINS;
      const req = makeReq(
        {
          origin: "https://app.replybase.co.uk",
          referer: "https://app.replybase.co.uk/integrations/webchat/test",
        },
        "https://app.replybase.co.uk/api/webchat/init",
      );
      await isWebchatOriginAllowed(req);
      expect(getWebchatCorsOrigin(req)).toBe("https://app.replybase.co.uk");
    });

    it("returns empty string when origin is not allowed", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://example.com";
      const req = makeReq({ origin: "https://evil.com" });
      await isWebchatOriginAllowed(req);
      expect(getWebchatCorsOrigin(req)).toBe("");
    });

    it("returns the request origin when no WEBCHAT_ALLOWED_ORIGINS is configured", async () => {
      delete process.env.WEBCHAT_ALLOWED_ORIGINS;
      (process.env as Record<string, string>).NODE_ENV = "production";
      const req = makeReq({ origin: "https://www.vivescriptsolutions.com" });
      await isWebchatOriginAllowed(req);
      expect(getWebchatCorsOrigin(req)).toBe(
        "https://www.vivescriptsolutions.com",
      );
    });
  });
});
