import { describe, it, expect, vi, beforeEach } from "vitest";
import { processWhatsAppJob } from "@/lib/services/whatsapp-worker";
import { prisma } from "@/lib/prisma";
import { checkTenantUsageLimits } from "@/lib/subscription";
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
    usageLog: {
      aggregate: vi.fn(),
    },
  },
}));

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

vi.mock("@/lib/services/lead-service", () => ({
  leadService: {
    syncContactIdentifiedStatus: vi.fn(),
    extractAndSyncLeadDataFromMessage: vi.fn(),
  },
}));

describe("WhatsApp Subscription Limits Integration", () => {
  const mockPayload = {
    channel: {
      id: "chan_1",
      botId: "bot_1",
      accessToken: "encrypted",
      config: { provider: "meta_cloud" },
      bot: { tenantId: "tenant_1" },
    },
    waId: "447700900000",
    inboundText: "Hello",
    messageId: "msg_1",
    botId: "bot_1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow message processing in GRACE zone (100% - 110%)", async () => {
    vi.mocked(checkTenantUsageLimits).mockResolvedValue({
      allowed: true,
      current: 105,
      limit: 100,
      status: { zone: "GRACE", ratio: 1.05, message: "Grace period", allowed: true } as any,
    });

    vi.mocked(prisma.contact.findFirst).mockResolvedValue({ id: "cont_1" } as any);
    vi.mocked(prisma.crmConversation.findFirst).mockResolvedValue({ id: "conv_1" } as any);
    vi.mocked(prisma.bot.findUnique).mockResolvedValue({ enabled: true } as any);
    vi.mocked(executeBotEntryFlowFirst).mockResolvedValue({ responses: [] } as any);

    await processWhatsAppJob(mockPayload);

    // Should have processed the inbound message even if over limit (GRACE)
    expect(prisma.crmMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ direction: "inbound" })
    }));
  });

  it("should block message processing in HARD zone (> 110%)", async () => {
    vi.mocked(checkTenantUsageLimits).mockResolvedValue({
      allowed: false,
      current: 115,
      limit: 100,
      status: { zone: "HARD", ratio: 1.15, message: "Hard limit", allowed: false } as any,
    });

    await processWhatsAppJob(mockPayload);

    // Should NOT have created the inbound message
    expect(prisma.crmMessage.create).not.toHaveBeenCalled();
  });

  it("should check limits before sending automated replies", async () => {
    // Inbound is allowed
    vi.mocked(checkTenantUsageLimits)
      .mockResolvedValueOnce({
        allowed: true, current: 0, limit: 100, status: { allowed: true } as any
      })
      // Outbound check fails
      .mockResolvedValueOnce({
        allowed: false, current: 115, limit: 100, status: { allowed: false } as any
      });

    vi.mocked(prisma.contact.findFirst).mockResolvedValue({ id: "cont_1" } as any);
    vi.mocked(prisma.crmConversation.findFirst).mockResolvedValue({ id: "conv_1" } as any);
    vi.mocked(prisma.bot.findUnique).mockResolvedValue({ enabled: true, entryFlow: "f" } as any);
    
    vi.mocked(executeBotEntryFlowFirst).mockResolvedValue({
      responses: [{ type: "text", text: "Automated reply" }],
    } as any);

    await processWhatsAppJob(mockPayload);

    // Inbound created
    expect(prisma.crmMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ direction: "inbound" })
    }));
    
    // Outbound NOT sent and NOT created
    expect(sendWhatsAppText).not.toHaveBeenCalled();
    expect(prisma.crmMessage.create).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ direction: "outbound" })
    }));
  });
});
