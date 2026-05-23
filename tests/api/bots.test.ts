import { NextRequest } from "next/server";
import { GET } from "@/app/api/bots/route";
import { prisma } from "@/lib/prisma";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bot: {
      findMany: vi.fn(),
    },
    channel: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/subscription", () => ({
  checkBotLimit: vi.fn(),
}));

vi.mock("@/lib/route-helpers", () => ({
  withAuthAndTenant: (fn: any) => async (request: any, context: any) => {
    return fn({ tenantId: "test-tenant", id: "test-user" }, request, context, prisma);
  },
}));

describe("Bots List API Route (GET)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the list of bots with their mapped channels in a batched manner", async () => {
    const req = new NextRequest("http://localhost/api/bots");

    const mockBots = [
      { id: "bot-1", name: "Bot 1", enabled: true, createdAt: new Date() },
      { id: "bot-2", name: "Bot 2", enabled: false, createdAt: new Date() },
    ];

    const mockChannels = [
      { id: "chan-1", botId: "bot-1", type: "web", name: "Web Channel", enabled: true, isActive: true },
      { id: "chan-2", botId: "bot-1", type: "telegram", name: "Telegram Channel", enabled: false, isActive: true },
      { id: "chan-3", botId: "bot-2", type: "whatsapp", name: "WhatsApp Channel", enabled: true, isActive: true },
    ];

    const mockLimitStatus = { allowed: true, limit: 5, current: 2, planName: "scale" };

    vi.mocked(prisma.bot.findMany).mockResolvedValue(mockBots as any);
    vi.mocked(prisma.channel.findMany).mockResolvedValue(mockChannels as any);
    
    const { checkBotLimit } = await import("@/lib/subscription");
    vi.mocked(checkBotLimit).mockResolvedValue(mockLimitStatus as any);

    const res = await GET(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(prisma.bot.findMany).toHaveBeenCalledWith({
      where: { tenantId: "test-tenant" },
      orderBy: { createdAt: "desc" },
    });

    expect(prisma.channel.findMany).toHaveBeenCalledWith({
      where: { botId: { in: ["bot-1", "bot-2"] } },
      select: {
        id: true,
        botId: true,
        type: true,
        name: true,
        enabled: true,
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    });

    expect(data.limitStatus).toEqual(mockLimitStatus);
    expect(data.bots).toHaveLength(2);
    
    // Bot 1 validation
    expect(data.bots[0].id).toBe("bot-1");
    expect(data.bots[0].name).toBe("Bot 1");
    expect(data.bots[0].status).toBe(true);
    expect(data.bots[0].primaryChannel).toBe("web");
    expect(data.bots[0].channels).toHaveLength(2);
    expect(data.bots[0].channels[0]).toEqual({
      id: "chan-1",
      type: "web",
      name: "Web Channel",
      enabled: true,
      isActive: true,
    });
    
    // Bot 2 validation
    expect(data.bots[1].id).toBe("bot-2");
    expect(data.bots[1].name).toBe("Bot 2");
    expect(data.bots[1].status).toBe(false);
    expect(data.bots[1].primaryChannel).toBe("whatsapp");
    expect(data.bots[1].channels).toHaveLength(1);
    expect(data.bots[1].channels[0]).toEqual({
      id: "chan-3",
      type: "whatsapp",
      name: "WhatsApp Channel",
      enabled: true,
      isActive: true,
    });
  });

  it("should return empty bots and not query channels if no bots exist", async () => {
    const req = new NextRequest("http://localhost/api/bots");
    vi.mocked(prisma.bot.findMany).mockResolvedValue([]);
    const { checkBotLimit } = await import("@/lib/subscription");
    vi.mocked(checkBotLimit).mockResolvedValue({ allowed: true, limit: 5, current: 0, planName: "scale" } as any);

    const res = await GET(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(prisma.bot.findMany).toHaveBeenCalled();
    expect(prisma.channel.findMany).not.toHaveBeenCalled();
    expect(data.bots).toHaveLength(0);
  });
});
