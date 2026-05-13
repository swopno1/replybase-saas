import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/whatsapp/webhook/route";
import { prisma } from "@/lib/prisma";
import { messageQueue } from "@/lib/queue";
import { NextRequest } from "next/server";
import {
  generateMetaWebhookPayload,
  generateMetaSignature,
} from "../../utils/whatsapp-sim";
import { encryptWhatsAppCredentialEnvelope } from "@/lib/whatsapp-channel-credentials";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    channel: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    webhookLog: {
      create: vi.fn().mockReturnValue({ catch: vi.fn() }),
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/queue", () => ({
  messageQueue: {
    add: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("WhatsApp Reliability & Resilience", () => {
  const APP_SECRET = "test_app_secret";
  
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WHATSAPP_APP_SECRET = APP_SECRET;
    process.env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY = "test-key-for-unit-tests-32chars!!";
  });

  it("should handle duplicate jobs using BullMQ jobId", async () => {
    const phoneNumberId = "phone_789";
    const accessToken = encryptWhatsAppCredentialEnvelope({
      provider: "meta_cloud",
      credentials: { accessToken: "tok", phoneNumberId, appSecret: APP_SECRET },
    });

    vi.mocked(prisma.channel.findFirst).mockResolvedValue({
      id: "chan_1",
      botId: "bot_1",
      accessToken,
      config: { provider: "meta_cloud" },
      bot: { tenantId: "tenant_1" },
    } as any);

    const messageId = "msg_duplicate_123";
    const payload = generateMetaWebhookPayload({
      from: "447700900000",
      body: "First attempt",
      messageId,
      phoneNumberId,
    });

    const bodyText = JSON.stringify(payload);
    const signature = generateMetaSignature(bodyText, APP_SECRET);

    const req = new NextRequest("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
      },
      body: bodyText,
    });

    await POST(req);

    // Verify jobId was passed correctly to BullMQ
    expect(messageQueue.add).toHaveBeenCalledWith(
      "whatsapp-message",
      expect.anything(),
      expect.objectContaining({ jobId: `whatsapp-${messageId}` })
    );
  });

  it("should gracefullly handle DB errors during webhook logging", async () => {
    const phoneNumberId = "phone_789";
    const accessToken = encryptWhatsAppCredentialEnvelope({
      provider: "meta_cloud",
      credentials: { accessToken: "tok", phoneNumberId, appSecret: APP_SECRET },
    });

    vi.mocked(prisma.channel.findFirst).mockResolvedValue({
      id: "chan_1",
      botId: "bot_1",
      accessToken,
      config: { provider: "meta_cloud" },
      bot: { tenantId: "tenant_1" },
    } as any);

    // Simulate DB error on webhookLog creation
    vi.mocked(prisma.webhookLog.create).mockImplementation(() => {
        const promise = Promise.reject(new Error("DB Connection Error"));
        (promise as any).catch = vi.fn(); // Mocking the .catch() call in the code
        return promise as any;
    });

    const payload = generateMetaWebhookPayload({
      from: "447700900000",
      body: "Hello",
      messageId: "msg_err_1",
      phoneNumberId,
    });
    const bodyText = JSON.stringify(payload);
    const signature = generateMetaSignature(bodyText, APP_SECRET);

    const req = new NextRequest("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
      },
      body: bodyText,
    });

    // The route should still return 200 because it handles logging errors gracefully
    const response = await POST(req);
    expect(response.status).toBe(200);
    expect(messageQueue.add).toHaveBeenCalled(); // Message was still queued
  });

  it("should handle a burst of webhooks without losing messages", async () => {
    const phoneNumberId = "phone_burst";
    const accessToken = encryptWhatsAppCredentialEnvelope({
      provider: "meta_cloud",
      credentials: { accessToken: "tok", phoneNumberId, appSecret: APP_SECRET },
    });

    vi.mocked(prisma.channel.findFirst).mockResolvedValue({
      id: "chan_burst",
      botId: "bot_burst",
      accessToken,
      config: { provider: "meta_cloud" },
      bot: { tenantId: "tenant_burst" },
    } as any);

    const burstSize = 20;
    const requests = Array.from({ length: burstSize }).map((_, i) => {
      const payload = generateMetaWebhookPayload({
        from: "447700900000",
        body: `Burst message ${i}`,
        messageId: `msg_burst_${i}`,
        phoneNumberId,
      });
      const bodyText = JSON.stringify(payload);
      const signature = generateMetaSignature(bodyText, APP_SECRET);
      
      return new NextRequest("http://localhost/api/whatsapp/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
        },
        body: bodyText,
      });
    });

    await Promise.all(requests.map(req => POST(req)));

    expect(messageQueue.add).toHaveBeenCalledTimes(burstSize);
  });
});
