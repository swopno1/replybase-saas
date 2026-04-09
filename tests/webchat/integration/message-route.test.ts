/**
 * Integration tests for POST /api/webchat/message
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
    crmConversation: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    crmMessage: {
      create: vi.fn().mockResolvedValue({ id: "msg_1" }),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/webchat-session", () => ({
  verifyWebchatSessionToken: vi.fn(),
}));

vi.mock("@/lib/webchat", () => ({
  isOriginAllowedForSite: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/ai-engine", () => ({
  converse: vi.fn(),
  AiEngineError: class AiEngineError extends Error {},
}));

vi.mock("@/lib/webchat-conversation-engine", () => ({
  buildWebchatSourceContext: vi.fn().mockReturnValue({ origin: null }),
  executeWebchatFlowFirst: vi.fn().mockResolvedValue(null),
  mergeConversationMetadata: vi.fn().mockReturnValue({}),
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

import { POST } from "@/app/api/webchat/message/route";
import { prisma } from "@/lib/prisma";
import { verifyWebchatSessionToken } from "@/lib/webchat-session";
import { isOriginAllowedForSite } from "@/lib/webchat";
import { converse } from "@/lib/ai-engine";
import { executeWebchatFlowFirst } from "@/lib/webchat-conversation-engine";
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

const mockConversation = {
  id: "conv_1",
  botId: "bot_1",
  channel: "web",
  contactId: "contact_1",
  botPaused: false,
  metadata: {},
  bot: { id: "bot_1", name: "TestBot", entryFlow: null, welcomeMessage: null },
};

const mockWebChatSession = {
  id: "ws_1",
  siteId: "site_1",
  visitorId: "visitor_1",
  metadata: {},
  externalSessionId: null,
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
    message: "Hello bot",
    botSignals: { honeypot: "" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/webchat/message — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyWebchatSessionToken).mockReturnValue(
      mockTokenPayload as never,
    );
    vi.mocked(prisma.webChatSite.findUnique).mockResolvedValue(
      mockSite as never,
    );
    vi.mocked(prisma.crmConversation.findUnique).mockResolvedValue(
      mockConversation as never,
    );
    vi.mocked(prisma.webChatSession.findFirst).mockResolvedValue(
      mockWebChatSession as never,
    );
    vi.mocked(prisma.crmMessage.findFirst).mockResolvedValue(null as never);
    vi.mocked(isOriginAllowedForSite).mockReturnValue(true);
    vi.mocked(executeWebchatFlowFirst).mockResolvedValue(null);
    vi.mocked(getWebchatRolloutDecision).mockResolvedValue({
      allowed: true,
      mode: "off",
      reason: "rollout_not_enforced",
    });
    vi.mocked(converse).mockResolvedValue({
      sessionId: "ai_session_1",
      responses: [{ type: "text", text: "Hello from AI" }],
    } as never);
    delete process.env.WEBCHAT_ALLOWED_ORIGINS;
  });

  // -------------------------------------------------------------------------
  // CORS
  // -------------------------------------------------------------------------
  describe("CORS check", () => {
    it("returns 403 when origin not in allowlist", async () => {
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
      const req = makeReq({ message: "hi" });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid request");
    });

    it("returns 400 for empty message", async () => {
      const req = makeReq({ token: "tok", message: "" });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("accepts widget metadata when optional fields are null", async () => {
      const req = makeReq(
        validBody({
          metadata: {
            pageUrl: "https://www.vivescriptsolutions.com/",
            referrer: null,
            locale: "en-GB",
            pageTitle: "ViveScript Solutions",
            userAgent: "Mozilla/5.0",
            origin: "https://www.vivescriptsolutions.com",
            utmSource: null,
            utmMedium: null,
            utmCampaign: null,
            utmTerm: null,
            utmContent: null,
          },
        }),
        { origin: "https://www.vivescriptsolutions.com" },
      );
      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  describe("session token auth", () => {
    it("returns 401 when session token is invalid", async () => {
      vi.mocked(verifyWebchatSessionToken).mockImplementation(() => {
        throw new Error("Token expired");
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
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Webchat site not found");
    });

    it("returns 404 when conversation channel is not web", async () => {
      vi.mocked(prisma.crmConversation.findUnique).mockResolvedValue({
        ...mockConversation,
        channel: "telegram",
      } as never);
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(404);
    });

    it("returns 404 when conversation botId does not match token", async () => {
      vi.mocked(prisma.crmConversation.findUnique).mockResolvedValue({
        ...mockConversation,
        botId: "different_bot",
      } as never);
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // Bot mitigation
  // -------------------------------------------------------------------------
  describe("bot mitigation", () => {
    it("returns 403 when honeypot triggered", async () => {
      const req = makeReq(validBody({ botSignals: { honeypot: "filled" } }));
      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.reason).toBe("honeypot_triggered");
    });
  });

  // -------------------------------------------------------------------------
  // Human handoff
  // -------------------------------------------------------------------------
  describe("human handoff", () => {
    it("returns a human handoff response when bot automation is paused", async () => {
      vi.mocked(prisma.crmConversation.findUnique).mockResolvedValue({
        ...mockConversation,
        botPaused: true,
      } as never);

      const req = makeReq(validBody(), {
        origin: "https://www.vivescriptsolutions.com",
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.meta.mode).toBe("human_handoff");
      expect(json.responses[0].text).toContain("team member");
      expect(executeWebchatFlowFirst).not.toHaveBeenCalled();
      expect(converse).not.toHaveBeenCalled();
    });

    it("does not repeat the handoff notice after a human reply already exists", async () => {
      vi.mocked(prisma.crmConversation.findUnique).mockResolvedValue({
        ...mockConversation,
        botPaused: true,
      } as never);
      vi.mocked(prisma.crmMessage.findFirst)
        .mockResolvedValueOnce({ id: "msg_human_1" } as never)
        .mockResolvedValueOnce(null as never);

      const req = makeReq(validBody(), {
        origin: "https://www.vivescriptsolutions.com",
      });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.meta.mode).toBe("human_handoff_waiting");
      expect(json.responses).toEqual([]);
      expect(executeWebchatFlowFirst).not.toHaveBeenCalled();
      expect(converse).not.toHaveBeenCalled();
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
  // Happy path — AI response
  // -------------------------------------------------------------------------
  describe("AI response path", () => {
    it("returns 200 with AI responses and mode=ai", async () => {
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.responses).toBeDefined();
      expect(json.meta.mode).toBe("ai");
    });

    it("returns conversationId in the response", async () => {
      const req = makeReq(validBody());
      const res = await POST(req);
      const json = await res.json();
      expect(json.conversationId).toBe("conv_1");
    });
  });

  // -------------------------------------------------------------------------
  // Happy path — flow response
  // -------------------------------------------------------------------------
  describe("flow response path", () => {
    it("returns 200 with flow responses and mode=flow", async () => {
      vi.mocked(executeWebchatFlowFirst).mockResolvedValue({
        handled: true,
        flowSessionId: "flow_sess_1",
        flowId: "flow_1",
        flowName: "Welcome",
        responses: [{ type: "text", text: "Flow reply" }],
        completed: false,
      } as never);

      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.meta.mode).toBe("flow");
      expect(json.responses[0].text).toBe("Flow reply");
      expect(prisma.crmMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: "conv_1",
            direction: "inbound",
            content: "Hello bot",
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Safe fallback
  // -------------------------------------------------------------------------
  describe("safe fallback path", () => {
    it("returns 200 with fallback message when AI engine throws", async () => {
      vi.mocked(converse).mockRejectedValue(new Error("AI unavailable"));
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.meta.mode).toBe("safe_fallback");
      expect(json.responses).toHaveLength(1);
      expect(json.responses[0].type).toBe("text");
    });
  });
});
