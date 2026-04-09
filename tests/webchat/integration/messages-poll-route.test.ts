import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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
    crmMessage: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/webchat-session", () => ({
  verifyWebchatSessionToken: vi.fn(),
}));

vi.mock("@/lib/webchat", () => ({
  isOriginAllowedForSite: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/webchat-rollout", () => ({
  getWebchatRolloutDecision: vi.fn().mockResolvedValue({
    allowed: true,
    mode: "off",
    reason: "rollout_not_enforced",
  }),
}));

import { GET } from "@/app/api/webchat/messages/route";
import { prisma } from "@/lib/prisma";
import { verifyWebchatSessionToken } from "@/lib/webchat-session";

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

function makeReq(search: string, headers: Record<string, string> = {}) {
  const h: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = v;

  return {
    nextUrl: new URL(
      `https://app.replybase.co.uk/api/webchat/messages?${search}`,
    ),
    headers: { get: (n: string) => h[n.toLowerCase()] ?? null },
  } as unknown as NextRequest;
}

describe("GET /api/webchat/messages — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyWebchatSessionToken).mockReturnValue(
      mockTokenPayload as never,
    );
    vi.mocked(prisma.webChatSite.findUnique).mockResolvedValue(
      mockSite as never,
    );
    vi.mocked(prisma.webChatSession.findFirst).mockResolvedValue({
      id: "sess_1",
      siteId: "site_1",
    } as never);
    vi.mocked(prisma.crmMessage.findMany).mockResolvedValue([
      {
        id: "msg_human_1",
        conversationId: "conv_1",
        direction: "outbound",
        content: "Hi, a team member is here to help.",
        source: "human",
        createdAt: new Date("2026-04-09T09:00:00.000Z"),
      },
    ] as never);
    delete process.env.WEBCHAT_ALLOWED_ORIGINS;
  });

  it("returns human replies newer than the cursor", async () => {
    const req = makeReq(
      "token=valid.session.token&after=2026-04-09T08:59:00.000Z",
      { origin: "https://www.vivescriptsolutions.com" },
    );

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.messages).toHaveLength(1);
    expect(json.messages[0].source).toBe("human");
    expect(json.messages[0].text).toContain("team member");
  });
});
