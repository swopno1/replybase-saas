/**
 * Integration tests for POST /api/webchat/init
 *
 * Mocks all DB/external deps so the full handler logic can run in a
 * pure Node.js Vitest environment with no real database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before the route import
// ---------------------------------------------------------------------------
vi.mock("@/lib/prisma", () => ({
  prisma: {
    webChatEvent: {
      create: vi.fn().mockResolvedValue({ id: "evt_1" }),
    },
  },
}));

vi.mock("@/lib/webchat", () => ({
  findActiveWebChatSite: vi.fn(),
  findActiveWebChannel: vi.fn(),
  getOrCreateWebChatSite: vi.fn(),
  isOriginAllowedForSite: vi.fn().mockReturnValue(true),
  resolveWebchatVisitorSession: vi.fn(),
}));

vi.mock("@/lib/webchat-session", () => ({
  createWebchatSessionToken: vi.fn().mockReturnValue("signed.session.token"),
}));

vi.mock("@/lib/webchat-init-challenge", () => ({
  consumeWebchatInitChallenge: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/webchat-diagnostics", () => ({
  recordWebchatErrorEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/webchat-metrics", () => ({
  recordWebchatMetric: vi.fn(),
}));

vi.mock("@/lib/webchat-rollout", () => ({
  getWebchatRolloutDecision: vi.fn().mockResolvedValue({
    allowed: true,
    mode: "off",
    reason: "rollout_not_enforced",
  }),
}));

// Use real CORS / bot-mitigation / rate-limit helpers (pure in-memory)

import { POST } from "@/app/api/webchat/init/route";
import {
  findActiveWebChatSite,
  getOrCreateWebChatSite,
  isOriginAllowedForSite,
  resolveWebchatVisitorSession,
  findActiveWebChannel,
} from "@/lib/webchat";
import { consumeWebchatInitChallenge } from "@/lib/webchat-init-challenge";
import { getWebchatRolloutDecision } from "@/lib/webchat-rollout";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockSite = {
  id: "site_1",
  publicKey: "pk_test_1",
  channelId: "chan_1",
  allowedDomains: [],
  isActive: true,
  themeConfig: {},
  bot: { id: "bot_1", tenantId: "tenant_1" },
};

const mockSession = {
  visitorId: "visitor_1",
  conversation: { id: "conv_1" },
  webChatSession: { id: "ws_1" },
};

let __reqCounter = 0;
function makeReq(
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  const h: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = v;
  return {
    headers: { get: (n: string) => h[n.toLowerCase()] ?? null },
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    publicKey: `pk_${++__reqCounter}`,
    initChallenge: "ch_abc",
    botSignals: { honeypot: "", elapsedMs: 1000 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/webchat/init — integration", () => {
  beforeEach(() => {
    vi.mocked(findActiveWebChatSite).mockResolvedValue(mockSite as never);
    vi.mocked(resolveWebchatVisitorSession).mockResolvedValue(
      mockSession as never,
    );
    vi.mocked(isOriginAllowedForSite).mockReturnValue(true);
    vi.mocked(consumeWebchatInitChallenge).mockResolvedValue(undefined);
    vi.mocked(getWebchatRolloutDecision).mockResolvedValue({
      allowed: true,
      mode: "off",
      reason: "rollout_not_enforced",
    });
    // Ensure dev-mode CORS (wildcard) by default
    delete process.env.WEBCHAT_ALLOWED_ORIGINS;
    delete process.env.NODE_ENV_OVERRIDE;
  });

  // -------------------------------------------------------------------------
  // CORS
  // -------------------------------------------------------------------------
  describe("CORS check", () => {
    it("returns 403 when origin is not in allowlist", async () => {
      process.env.WEBCHAT_ALLOWED_ORIGINS = "https://allowed.com";
      const req = makeReq(validBody(), { origin: "https://evil.com" });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("Origin not allowed");
    });

    it("passes when no WEBCHAT_ALLOWED_ORIGINS set (dev wildcard)", async () => {
      delete process.env.WEBCHAT_ALLOWED_ORIGINS;
      const req = makeReq(validBody());
      const res = await POST(req);
      // Should reach at least schema-parsing stage — not 403 CORS
      expect(res.status).not.toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Schema validation
  // -------------------------------------------------------------------------
  describe("schema validation", () => {
    it("returns 400 when initChallenge is missing", async () => {
      const req = makeReq({ publicKey: "pk_test" });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid request");
      expect(json.details).toBeDefined();
    });

    it("returns 400 when no identifier (publicKey/channelId/botId) provided", async () => {
      const req = makeReq({ initChallenge: "ch_abc" });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid contact email", async () => {
      const req = makeReq(validBody({ contact: { email: "not-an-email" } }));
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Bot mitigation
  // -------------------------------------------------------------------------
  describe("bot mitigation", () => {
    it("returns 403 when honeypot is filled", async () => {
      const req = makeReq(
        validBody({
          botSignals: { honeypot: "robot content", elapsedMs: 1000 },
        }),
      );
      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("Request blocked");
      expect(json.reason).toBe("honeypot_triggered");
    });

    it("returns 403 when elapsedMs is below threshold on init stage", async () => {
      const req = makeReq(
        validBody({ botSignals: { honeypot: "", elapsedMs: 10 } }),
      );
      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.reason).toBe("interaction_too_fast");
    });
  });

  // -------------------------------------------------------------------------
  // Channel / site resolution
  // -------------------------------------------------------------------------
  describe("channel resolution", () => {
    it("returns 404 when channel search finds nothing", async () => {
      vi.mocked(findActiveWebChatSite).mockResolvedValue(null);
      vi.mocked(
        findActiveWebChannel as unknown as () => null,
      ).mockResolvedValue(null);
      const req = makeReq(validBody({ channelId: "chan_missing" }));
      const res = await POST(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("web channel not found");
    });
  });

  // -------------------------------------------------------------------------
  // Init challenge
  // -------------------------------------------------------------------------
  describe("init challenge", () => {
    it("returns 400 when init challenge is invalid or expired", async () => {
      vi.mocked(consumeWebchatInitChallenge).mockRejectedValue(
        new Error("Challenge expired"),
      );
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid init challenge");
      expect(json.message).toBe("Challenge expired");
    });
  });

  // -------------------------------------------------------------------------
  // Site-level origin check
  // -------------------------------------------------------------------------
  describe("site origin check", () => {
    it("returns 403 when origin is not allowed for site", async () => {
      vi.mocked(isOriginAllowedForSite).mockReturnValue(false);
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("Origin not allowed for this site");
    });
  });

  // -------------------------------------------------------------------------
  // Rollout gating
  // -------------------------------------------------------------------------
  describe("rollout gating", () => {
    it("returns 403 when tenant is blocked by rollout policy", async () => {
      vi.mocked(getWebchatRolloutDecision).mockResolvedValue({
        allowed: false,
        mode: "pilot",
        reason: "pilot_only",
      });
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("Webchat is not enabled for this tenant");
      expect(json.reason).toBe("pilot_only");
    });
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------
  describe("success", () => {
    it("returns 200 with token and session fields", async () => {
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.token).toBe("signed.session.token");
      expect(json.visitorId).toBe("visitor_1");
      expect(json.conversationId).toBe("conv_1");
      expect(json.siteId).toBe("site_1");
    });

    it("response includes expiresIn", async () => {
      const req = makeReq(validBody());
      const res = await POST(req);
      const json = await res.json();
      expect(json.expiresIn).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // OPTIONS preflight
  // -------------------------------------------------------------------------
  describe("OPTIONS preflight", () => {
    it("returns 204 in dev/wildcard mode", async () => {
      const { OPTIONS } = await import("@/app/api/webchat/init/route");
      const req = makeReq(null);
      const res = await OPTIONS(req);
      expect(res.status).toBe(204);
    });
  });
});
