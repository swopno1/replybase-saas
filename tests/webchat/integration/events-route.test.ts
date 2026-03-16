/**
 * Integration tests for POST /api/webchat/events
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/prisma", () => ({
  prisma: {
    webChatSite: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    webChatSession: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    webChatEvent: {
      create: vi.fn().mockResolvedValue({ id: "evt_1" }),
    },
  },
}));

vi.mock("@/lib/webchat-session", () => ({
  verifyWebchatSessionToken: vi.fn(),
}));

vi.mock("@/lib/webchat", () => ({
  isOriginAllowedForSite: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/webchat-telemetry", () => ({
  getWebchatTelemetryPolicy: vi.fn().mockReturnValue({ sampleRate: 1.0 }),
  normalizeWebchatTelemetryPayload: vi
    .fn()
    .mockImplementation((_, p) => p ?? {}),
  shouldSampleWebchatTelemetry: vi.fn().mockReturnValue(true),
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

import { POST } from "@/app/api/webchat/events/route";
import { prisma } from "@/lib/prisma";
import { verifyWebchatSessionToken } from "@/lib/webchat-session";
import { isOriginAllowedForSite } from "@/lib/webchat";
import {
  shouldSampleWebchatTelemetry,
  getWebchatTelemetryPolicy,
} from "@/lib/webchat-telemetry";
import { recordWebchatMetric } from "@/lib/webchat-metrics";
import { getWebchatRolloutDecision } from "@/lib/webchat-rollout";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockTokenPayload = {
  siteId: "site_1",
  channelId: "chan_1",
  botId: "bot_1",
  tenantId: "tenant_1",
  conversationId: "conv_1",
  visitorId: "visitor_1",
};

const mockSite = {
  id: "site_1",
  isActive: true,
  allowedDomains: [],
};

const mockWebChatSession = {
  id: "ws_1",
  siteId: "site_1",
  visitorId: "visitor_1",
};

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
    token: "valid.session.token",
    type: "OPEN",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/webchat/events — integration", () => {
  beforeEach(() => {
    vi.mocked(verifyWebchatSessionToken).mockReturnValue(
      mockTokenPayload as never,
    );
    vi.mocked(prisma.webChatSite.findUnique).mockResolvedValue(
      mockSite as never,
    );
    vi.mocked(prisma.webChatSession.findFirst).mockResolvedValue(
      mockWebChatSession as never,
    );
    vi.mocked(isOriginAllowedForSite).mockReturnValue(true);
    vi.mocked(shouldSampleWebchatTelemetry).mockReturnValue(true);
    vi.mocked(getWebchatRolloutDecision).mockResolvedValue({
      allowed: true,
      mode: "off",
      reason: "rollout_not_enforced",
    });
    vi.mocked(getWebchatTelemetryPolicy).mockReturnValue({
      sampleRate: 1.0,
    } as never);
    delete process.env.WEBCHAT_ALLOWED_ORIGINS;
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
  });

  // -------------------------------------------------------------------------
  // Schema validation
  // -------------------------------------------------------------------------
  describe("schema validation", () => {
    it("returns 400 for missing token", async () => {
      const req = makeReq({ type: "OPEN" });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid request");
    });

    it("returns 400 for unknown event type", async () => {
      const req = makeReq({ token: "tok", type: "UNKNOWN" });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("accepts all valid event types", async () => {
      for (const type of ["OPEN", "CLOSE", "TYPING", "ERROR", "MESSAGE"]) {
        const req = makeReq(validBody({ type }));
        const res = await POST(req);
        // Should not be 400 schema error
        expect(res.status).not.toBe(400);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  describe("session token auth", () => {
    it("returns 401 when session token is invalid", async () => {
      vi.mocked(verifyWebchatSessionToken).mockImplementation(() => {
        throw new Error("Invalid token");
      });
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Invalid session token");
    });
  });

  // -------------------------------------------------------------------------
  // Resource resolution
  // -------------------------------------------------------------------------
  describe("resource resolution", () => {
    it("returns 404 when site is not found", async () => {
      vi.mocked(prisma.webChatSite.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.webChatSite.findFirst).mockResolvedValue(null);
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Webchat site not found");
    });
  });

  // -------------------------------------------------------------------------
  // Site-level origin check
  // -------------------------------------------------------------------------
  describe("site origin check", () => {
    it("returns 403 when origin not allowed for site", async () => {
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
  // Telemetry sampling
  // -------------------------------------------------------------------------
  describe("telemetry sampling", () => {
    it("returns ok=true sampled=false when event is sampled out", async () => {
      vi.mocked(shouldSampleWebchatTelemetry).mockReturnValue(false);
      vi.mocked(getWebchatTelemetryPolicy).mockReturnValue({
        sampleRate: 0.1,
      } as never);
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.sampled).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------
  describe("success", () => {
    it("returns 200 with ok=true and sampled=true", async () => {
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.sampled).toBe(true);
    });

    it("emits webchat.event.tracked metric on success", async () => {
      vi.mocked(recordWebchatMetric).mockClear();
      const req = makeReq(validBody({ type: "CLOSE" }));
      await POST(req);
      expect(vi.mocked(recordWebchatMetric)).toHaveBeenCalledWith(
        "webchat.event.tracked",
        expect.objectContaining({ type: "CLOSE", siteId: "site_1" }),
      );
    });

    it("persists WebChatEvent to DB", async () => {
      vi.mocked(prisma.webChatEvent.create).mockClear();
      const req = makeReq(validBody({ type: "TYPING" }));
      await POST(req);
      expect(vi.mocked(prisma.webChatEvent.create)).toHaveBeenCalledOnce();
    });
  });
});
