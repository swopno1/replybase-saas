import { describe, it, expect, vi, beforeEach } from "vitest";
import { processWhatsAppJob } from "@/lib/services/whatsapp-worker";
import { prisma } from "@/lib/prisma";
import { checkTenantUsageLimits, incrementTenantUsage } from "@/lib/subscription";
import { executeBotEntryFlowFirst } from "@/lib/bot-entry-flow-engine";
import { sendWhatsAppText } from "@/lib/whatsapp-provider";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    crmConversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    crmMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    channel: {
      update: vi.fn(),
    },
    bot: {
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    usageLog: {
      aggregate: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Mock getTenantPrisma to return the same mocked prisma instance so assertions still work
vi.mock("@/lib/prisma-tenant", async () => {
  const { prisma } = await import("@/lib/prisma");
  return { getTenantPrisma: () => prisma };
});


vi.mock("@/lib/subscription", () => ({
  checkTenantUsageLimits: vi.fn(),
  incrementTenantUsage: vi.fn(),
}));

vi.mock("@/lib/bot-entry-flow-engine", () => ({
  executeBotEntryFlowFirst: vi.fn(),
}));

vi.mock("@/lib/whatsapp-provider", () => ({
  sendWhatsAppText: vi.fn(),
  normalizeWhatsAppAddress: vi.fn((v) => v),
  normalizeWhatsAppE164: vi.fn((v) => v),
}));

vi.mock("@/lib/whatsapp-channel-credentials", () => ({
  decryptWhatsAppCredentialEnvelope: vi.fn().mockReturnValue({
    provider: "meta_cloud",
    credentials: { accessToken: "tok", phoneNumberId: "123" },
  }),
  getStringFromJsonConfig: vi.fn().mockReturnValue("meta_cloud"),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock lead service to avoid complex setup
vi.mock("@/lib/services/lead-service", () => ({
  leadService: {
    syncContactIdentifiedStatus: vi.fn(),
    extractAndSyncLeadDataFromMessage: vi.fn(),
  },
}));

describe("WhatsApp Worker Integration", () => {
  const mockPayload = {
    channel: {
      id: "chan_1",
      botId: "bot_1",
      accessToken: "encrypted",
      config: { provider: "meta_cloud" },
      bot: { tenantId: "tenant_1" },
    },
    waId: "447700900000",
    inboundText: "Hello AI",
    messageId: "msg_1",
    botId: "bot_1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkTenantUsageLimits).mockResolvedValue({
      allowed: true,
      current: 0,
      limit: 1000,
      status: { zone: "SAFE", ratio: 0, message: "", allowed: true } as any,
    });
  });

  it("should block processing if conversation limit reached", async () => {
    vi.mocked(checkTenantUsageLimits).mockResolvedValue({
      allowed: false,
      current: 100,
      limit: 100,
      status: { zone: "HARD", ratio: 1, message: "Limit reached", allowed: false } as any,
    });

    await processWhatsAppJob(mockPayload);

    expect(prisma.contact.findFirst).not.toHaveBeenCalled();
    expect(prisma.crmMessage.create).not.toHaveBeenCalled();
  });

  it("should execute flow and send response if flow matches", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue({ id: "cont_1" } as any);
    vi.mocked(prisma.crmConversation.findFirst).mockResolvedValue({ id: "conv_1" } as any);
    vi.mocked(prisma.bot.findUnique).mockResolvedValue({ enabled: true, entryFlow: "flow_1" } as any);
    
    vi.mocked(executeBotEntryFlowFirst).mockResolvedValue({
      responses: [{ type: "text", text: "Flow response" }],
      state: {},
    } as any);

    vi.mocked(sendWhatsAppText).mockResolvedValue({ success: true });

    await processWhatsAppJob(mockPayload);

    expect(executeBotEntryFlowFirst).toHaveBeenCalled();
    expect(sendWhatsAppText).toHaveBeenCalledWith(expect.objectContaining({
      text: "Flow response",
    }));
    expect(incrementTenantUsage).toHaveBeenCalledWith("tenant_1", "message", 1, "bot_1", "chan_1");
  });

  it("should fallback to AI if no flow response", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue({ id: "cont_1" } as any);
    vi.mocked(prisma.crmConversation.findFirst).mockResolvedValue({ id: "conv_1" } as any);
    vi.mocked(prisma.bot.findUnique).mockResolvedValue({ enabled: true } as any);
    
    // No flow responses
    vi.mocked(executeBotEntryFlowFirst).mockResolvedValue({ responses: [] } as any);
    
    // Mock AI fallback
    vi.mocked(prisma.crmMessage.findMany).mockResolvedValue([]);
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({ plan: { name: "pro" } } as any);

    // Mock the dynamic import of aiFallback
    // In Vitest we can use vi.mock for modules used in dynamic imports too
    vi.mock("@/lib/ai-fallback", () => ({
      aiFallback: vi.fn().mockResolvedValue("AI fallback response"),
    }));

    vi.mocked(sendWhatsAppText).mockResolvedValue({ success: true });

    await processWhatsAppJob(mockPayload);

    expect(sendWhatsAppText).toHaveBeenCalledWith(expect.objectContaining({
      text: "AI fallback response",
    }));
  });
});
