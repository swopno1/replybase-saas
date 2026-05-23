import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/webchat/message/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmMessage: {
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    idempotencyKey: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
    },
    crmConversation: {
      findUnique: vi.fn(),
    },
    channel: {
      findFirst: vi.fn(),
    },
    bot: {
      findFirst: vi.fn(),
    },
    webchat_sites: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

vi.mock("@/lib/webchat-cors", () => ({
  isWebchatOriginAllowed: vi.fn().mockReturnValue(true),
  getWebchatOriginRejectionReason: vi.fn().mockReturnValue(null),
  createWebchatCorsHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/webchat", () => ({
  findActiveWebChannel: vi.fn(),
}));

vi.mock("@/lib/webchat-conversation-engine", () => ({
  buildWebchatSourceContext: vi.fn().mockReturnValue({}),
  executeWebchatFlowFirst: vi.fn(),
}));

vi.mock("@/lib/webchat-session", () => ({
  verifyWebchatSessionToken: vi.fn(),
}));

describe("Webchat Message API Optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls prisma.crmMessage.createMany once for all flow responses (optimized)", async () => {
    const mockChannel = {
      id: "chan_1",
      botId: "bot_1",
      bot: { tenantId: "tenant_1" },
      config: { fallbackMode: "ai" },
    };
    (prisma.channel.findFirst as any).mockResolvedValue(mockChannel);
    const { findActiveWebChannel } = await import("@/lib/webchat");
    (findActiveWebChannel as any).mockResolvedValue(mockChannel);

    (prisma.crmConversation.findUnique as any).mockResolvedValue({
      id: "conv_1",
      contactId: "contact_1",
      metadata: {},
    });

    const { verifyWebchatSessionToken } = await import("@/lib/webchat-session");
    (verifyWebchatSessionToken as any).mockReturnValue({ tenantId: "tenant_1" });

    const { executeWebchatFlowFirst } = await import("@/lib/webchat-conversation-engine");
    (executeWebchatFlowFirst as any).mockResolvedValue({
      handled: true,
      responses: [
        { type: "text", text: "Message 1" },
        { type: "text", text: "Message 2" },
      ],
      flowId: "flow_1",
    });

    const req = new NextRequest("http://localhost/api/webchat/message", {
      method: "POST",
      body: JSON.stringify({
        conversationId: "conv_1",
        botId: "bot_1",
        message: "Hello",
        planName: "scale",
      }),
    });

    await POST(req);

    // 1 for inbound message
    expect(prisma.crmMessage.create).toHaveBeenCalledTimes(1);
    expect(prisma.crmMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ direction: "inbound" })
    }));

    // 1 call for all outbound responses
    expect(prisma.crmMessage.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.crmMessage.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({ content: "Message 1", direction: "outbound" }),
        expect.objectContaining({ content: "Message 2", direction: "outbound" }),
      ]
    }));
  });
});
