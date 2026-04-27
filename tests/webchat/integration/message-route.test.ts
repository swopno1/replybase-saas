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
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/lib/webchat-session", () => ({
  verifyWebchatSessionToken: vi.fn(),
}));

vi.mock("@/lib/webchat", () => ({
  isOriginAllowedForSite: vi.fn().mockReturnValue(true),
  findActiveWebChannel: vi.fn(),
}));

vi.mock("@/lib/ai-fallback", () => ({
  aiFallback: vi.fn(),
  AI_FALLBACK_MESSAGE: "Our AI assistant is temporarily unavailable. Please try again shortly—your request is important to us.",
}));

vi.mock("@/lib/webchat-conversation-engine", () => ({
  executeWebchatFlowFirst: vi.fn().mockResolvedValue(null),
  buildWebchatSourceContext: vi.fn().mockReturnValue({}),
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

vi.mock("@/lib/subscription", () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, limit: 10 }),
  incrementUsage: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/webchat/message/route";
import { prisma } from "@/lib/prisma";
import { verifyWebchatSessionToken } from "@/lib/webchat-session";
import { isOriginAllowedForSite, findActiveWebChannel } from "@/lib/webchat";
import { aiFallback } from "@/lib/ai-fallback";
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

const mockActiveWebChannel = {
  id: "chan_1",
  name: "Web Channel",
  bot: { id: "bot_1", tenantId: "tenant_1" },
  config: {},
};

const mockConversation = {
  id: "conv_1",
  botId: "bot_1",
  channel: "web",
  contactId: "contact_1",
  botPaused: false,
  metadata: { siteId: "site_1" },
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
    conversationId: "conv_1",
    botId: "bot_1",
    message: "Hello bot",
    planName: "pro",
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
    vi.mocked(prisma.crmMessage.findMany).mockResolvedValue([] as never);
    vi.mocked(isOriginAllowedForSite).mockReturnValue(true);
    vi.mocked(findActiveWebChannel).mockResolvedValue(mockActiveWebChannel as never);
    vi.mocked(executeWebchatFlowFirst).mockResolvedValue(null);
    vi.mocked(getWebchatRolloutDecision).mockResolvedValue({
      allowed: true,
      mode: "off",
      reason: "rollout_not_enforced",
    });
    vi.mocked(aiFallback).mockResolvedValue({ text: "Hello from AI" } as never);
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
    it("returns 400 for missing conversationId", async () => {
      // The new endpoint validates missing required fields directly
      const req = makeReq({ message: "hi", botId: "bot1", planName: "pro" });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Missing required fields");
    });
  });

  // -------------------------------------------------------------------------
  // Resource resolution
  // -------------------------------------------------------------------------
  describe("resource resolution", () => {
    it("returns 404 when channel is not found", async () => {
      vi.mocked(findActiveWebChannel).mockResolvedValue(null);
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Channel not found");
    });

    it("returns 404 when crmConversation is not found", async () => {
      vi.mocked(prisma.crmConversation.findUnique).mockResolvedValue(null);
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // Happy path — AI response
  // -------------------------------------------------------------------------
  describe("AI response path", () => {
    it("returns 200 with AI responses and mode=ai_fallback", async () => {
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.responses).toBeDefined();
      expect(json.responses[0].text).toBe("Hello from AI");
      expect(json.meta.mode).toBe("ai_fallback");
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
      // ensure CRM message was created synchronously
      expect(prisma.crmMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: "Flow reply",
            direction: "outbound",
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Safe fallback
  // -------------------------------------------------------------------------
  describe("safe fallback path", () => {
    it("returns 200 with manual fallback message when AI engine throws", async () => {
      vi.mocked(aiFallback).mockRejectedValue(new Error("AI unavailable"));
      const req = makeReq(validBody());
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.meta.mode).toBe("manual_fallback");
      expect(json.responses).toHaveLength(1);
      expect(json.responses[0].type).toBe("text");
    });
  });
});
