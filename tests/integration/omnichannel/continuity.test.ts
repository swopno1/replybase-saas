import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { processWhatsAppJob } from "@/lib/services/whatsapp-worker";
// We need to import the other workers if they exist, or simulate them
// Assuming they follow a similar pattern

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    crmConversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    crmMessage: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    contactIdentity: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    bot: {
        findUnique: vi.fn(),
    },
    channel: {
        findFirst: vi.fn(),
        update: vi.fn(),
    }
  },
}));

// Mock getTenantPrisma to return the same mocked prisma instance so assertions still work
vi.mock("@/lib/prisma-tenant", async () => {
  const { prisma } = await import("@/lib/prisma");
  return { getTenantPrisma: () => prisma };
});

vi.mock("@/lib/queue", () => ({
  messageQueue: {
    add: vi.fn(),
  },
}));

vi.mock("@/lib/subscription", () => ({
  checkTenantUsageLimits: vi.fn().mockResolvedValue({ allowed: true }),
  incrementTenantUsage: vi.fn(),
}));

vi.mock("@/lib/whatsapp-provider", () => ({
  sendWhatsAppText: vi.fn().mockResolvedValue({ success: true }),
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

vi.mock("@/lib/bot-entry-flow-engine", () => ({
  executeBotEntryFlowFirst: vi.fn().mockResolvedValue({ responses: [] }),
}));

vi.mock("@/lib/services/lead-service", () => ({
  leadService: {
    syncContactIdentifiedStatus: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/contact-stitching", () => ({
  stitchContactIdentities: vi.fn().mockResolvedValue({ previousVariables: {} }),
}));

describe("Omnichannel Continuity Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should maintain a single contact when a user switches from Webchat to WhatsApp using SYNC_", async () => {
    const tenantId = "tenant_1";
    const botId = "bot_1";
    const contactId = "contact_webchat_123";
    const waId = "447700900000";

    const mockContact = {
      id: contactId,
      tenantId,
      name: "Webchat User",
    };

    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContact as any);
    vi.mocked(prisma.contact.create).mockResolvedValue(mockContact as any);
    vi.mocked(prisma.crmConversation.findFirst).mockResolvedValue({ id: "conv_1" } as any);
    vi.mocked(prisma.crmConversation.create).mockResolvedValue({ id: "conv_1" } as any);

    // 2. Simulate WhatsApp SYNC message
    // The SYNC_ message usually contains a session hash that maps back to the webchat contactId or visitorId
    const syncMessage = `SYNC_${contactId}`; 

    const whatsappPayload = {
      channel: {
        id: "chan_wa_1",
        botId,
        bot: { tenantId },
        config: { provider: "meta_cloud" },
      },
      waId,
      inboundText: syncMessage,
      messageId: "wa_msg_1",
    };

    // We need to mock stitchContactIdentities or the logic inside the worker
    // Let's assume the worker calls stitchContactIdentities
    
    // For this test, we'll verify that prisma.contact.update or identity.create is called
    // to link the new waId to the existing contactId.

    await processWhatsAppJob(whatsappPayload);

    // Verify identity stitching was triggered
    const { stitchContactIdentities } = await import("@/lib/contact-stitching");
    expect(stitchContactIdentities).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        identifiedContactId: contactId,
        sessionHash: contactId, // syncMessage was `SYNC_${contactId}`
      })
    );
  });
});
