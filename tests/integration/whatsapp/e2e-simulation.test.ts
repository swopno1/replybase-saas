import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/whatsapp/webhook/route";
import { processWhatsAppJob } from "@/lib/services/whatsapp-worker";
import { prisma } from "@/lib/prisma";
import { messageQueue } from "@/lib/queue";
import { NextRequest } from "next/server";
import {
  generateMetaWebhookPayload,
  generateMetaSignature,
} from "../../utils/whatsapp-sim";
import { encryptWhatsAppCredentialEnvelope } from "@/lib/whatsapp-channel-credentials";
import { sendWhatsAppText } from "@/lib/whatsapp-provider";

// --- MOCK SETUP ---
vi.mock("@/lib/prisma", () => ({
  prisma: {
    channel: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
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
    webhookLog: {
      create: vi.fn().mockReturnValue({ catch: vi.fn() }),
      createMany: vi.fn(),
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

vi.mock("@/lib/queue", () => ({
  messageQueue: {
    add: vi.fn(),
  },
}));

vi.mock("@/lib/subscription", () => ({
  checkTenantUsageLimits: vi.fn().mockResolvedValue({
    allowed: true, current: 0, limit: 1000, status: { allowed: true } as any
  }),
  incrementTenantUsage: vi.fn(),
}));

vi.mock("@/lib/whatsapp-provider", () => ({
  sendWhatsAppText: vi.fn().mockResolvedValue({ success: true }),
  normalizeWhatsAppAddress: vi.fn((v) => v),
  normalizeWhatsAppE164: vi.fn((v) => v),
  verifyWebhookSignature: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/whatsapp-channel-credentials", () => ({
  decryptWhatsAppCredentialEnvelope: vi.fn().mockReturnValue({
    provider: "meta_cloud",
    credentials: { accessToken: "tok", phoneNumberId: "phone_123", appSecret: "secret" },
  }),
  encryptWhatsAppCredentialEnvelope: vi.fn().mockReturnValue("encrypted_token"),
  getStringFromJsonConfig: vi.fn().mockReturnValue("meta_cloud"),
}));

vi.mock("@/lib/bot-entry-flow-engine", () => ({
  executeBotEntryFlowFirst: vi.fn().mockResolvedValue({
    responses: [{ type: "text", text: "Automated response" }],
  }),
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

describe("WhatsApp Production E2E Cycle Simulation", () => {
  const APP_SECRET = "secret";
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete the full ingestion-to-reply cycle", async () => {
    // 1. SETUP MOCKS
    const tenantId = "t1";
    const botId = "b1";
    const channelId = "c1";
    const phoneNumberId = "phone_123";

    const channel = {
      id: channelId,
      botId,
      accessToken: "encrypted",
      config: { provider: "meta_cloud", metaPhoneNumberId: phoneNumberId },
      bot: { tenantId, id: botId, enabled: true, entryFlow: "flow_1" },
    };

    vi.mocked(prisma.channel.findFirst).mockResolvedValue(channel as any);
    vi.mocked(prisma.bot.findUnique).mockResolvedValue(channel.bot as any);
    vi.mocked(prisma.contact.findFirst).mockResolvedValue({ id: "contact_1" } as any);
    vi.mocked(prisma.crmConversation.findFirst).mockResolvedValue({ id: "conv_1" } as any);

    // 2. TRIGGER WEBHOOK (INBOUND)
    const payload = generateMetaWebhookPayload({
      from: "447700900000",
      body: "Hello ReplyBase",
      messageId: "wamid.123",
      phoneNumberId,
    });

    const req = new NextRequest("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=valid" },
      body: JSON.stringify(payload),
    });

    const webhookResponse = await POST(req);
    expect(webhookResponse.status).toBe(200);

    // 3. VERIFY QUEUE ADDITION
    expect(messageQueue.add).toHaveBeenCalledWith(
      "whatsapp-message",
      expect.objectContaining({
        type: "whatsapp",
        botId: "b1",
        payload: expect.objectContaining({
          messageId: "wamid.123",
          inboundText: "Hello ReplyBase",
        }),
      }),
      expect.objectContaining({ jobId: "whatsapp-wamid.123" })
    );

    // 4. SIMULATE WORKER EXECUTION
    const jobPayload = vi.mocked(messageQueue.add).mock.calls[0][1];
    await processWhatsAppJob({ ...jobPayload.payload, botId: jobPayload.botId });

    // 5. VERIFY DB PERSISTENCE (INBOUND)
    expect(prisma.crmMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "Hello ReplyBase",
          direction: "inbound",
          tenantId,
        }),
      })
    );

    // 6. VERIFY FLOW EXECUTION & OUTBOUND SEND
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "447700900000",
        text: "Automated response",
      })
    );

    // 7. VERIFY DB PERSISTENCE (OUTBOUND)
    expect(prisma.crmMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "Automated response",
          direction: "outbound",
          source: "flow",
        }),
      })
    );

    // 8. VERIFY USAGE INCREMENT
    const { incrementTenantUsage } = await import("@/lib/subscription");
    expect(incrementTenantUsage).toHaveBeenCalledWith(tenantId, "message", 1, botId, channelId);
  });
});
