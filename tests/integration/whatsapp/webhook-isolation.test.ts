import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

describe("WhatsApp Webhook Tenant Isolation", () => {
  const APP_SECRET = "test_app_secret";
  
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WHATSAPP_APP_SECRET = APP_SECRET;
    process.env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY = "test-key-for-unit-tests-32chars!!";
  });

  afterEach(() => {
    delete process.env.WHATSAPP_APP_SECRET;
  });

  it("should correctly route message to the specific tenant and bot", async () => {
    const tenantId = "tenant_123";
    const botId = "bot_456";
    const phoneNumberId = "phone_789";
    const accessToken = encryptWhatsAppCredentialEnvelope({
      provider: "meta_cloud",
      credentials: { accessToken: "tok", phoneNumberId, appSecret: APP_SECRET },
    });

    const mockChannel = {
      id: "chan_1",
      botId,
      accessToken,
      config: { provider: "meta_cloud" },
      bot: {
        tenantId,
        id: botId,
      },
    };

    // Mock prisma finding the channel for this phone number
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(mockChannel as any);

    const payload = generateMetaWebhookPayload({
      from: "447700900000",
      body: "Hello from Tenant 1",
      messageId: "msg_abc123",
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

    const response = await POST(req);
    expect(response.status).toBe(200);

    // Verify it was added to the queue for the correct bot
    expect(messageQueue.add).toHaveBeenCalledWith(
      "whatsapp-message",
      expect.objectContaining({
        type: "whatsapp",
        botId: botId,
        payload: expect.objectContaining({
          waId: "447700900000",
          inboundText: "Hello from Tenant 1",
          channel: expect.objectContaining({
            botId: botId,
          }),
        }),
      }),
      expect.anything()
    );

    // Verify it logged the webhook for the correct tenant
    expect(prisma.webhookLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantId,
          source: "whatsapp",
        }),
      })
    );
  });

  it("should fail signature validation if appSecret does not match", async () => {
    const tenantId = "tenant_123";
    const botId = "bot_456";
    const phoneNumberId = "phone_789";
    const wrongAppSecret = "wrong_secret";
    
    const accessToken = encryptWhatsAppCredentialEnvelope({
      provider: "meta_cloud",
      credentials: { accessToken: "tok", phoneNumberId, appSecret: APP_SECRET },
    });

    const mockChannel = {
      id: "chan_1",
      botId,
      accessToken,
      config: { provider: "meta_cloud" },
      bot: {
        tenantId,
        id: botId,
      },
    };

    vi.mocked(prisma.channel.findFirst).mockResolvedValue(mockChannel as any);

    const payload = generateMetaWebhookPayload({
      from: "447700900000",
      body: "Tampered message",
      messageId: "msg_bad",
      phoneNumberId,
    });

    const bodyText = JSON.stringify(payload);
    const signature = generateMetaSignature(bodyText, wrongAppSecret); // Signed with wrong secret

    const req = new NextRequest("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
      },
      body: bodyText,
    });

    const response = await POST(req);
    expect(response.status).toBe(403);
    expect(messageQueue.add).not.toHaveBeenCalled();
  });

  it("should not process if channel is disabled (killSwitch)", async () => {
    const phoneNumberId = "phone_789";
    
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null); // Simulated not found or inactive

    const payload = generateMetaWebhookPayload({
      from: "447700900000",
      body: "Hello",
      messageId: "msg_xyz",
      phoneNumberId,
    });

    const bodyText = JSON.stringify(payload);
    const req = new NextRequest("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: bodyText,
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.matched).toBe(false);
    expect(messageQueue.add).not.toHaveBeenCalled();
  });

  it("should correctly process image and document messages", async () => {
    const phoneNumberId = "phone_media";
    const accessToken = encryptWhatsAppCredentialEnvelope({
      provider: "meta_cloud",
      credentials: { accessToken: "tok", phoneNumberId, appSecret: APP_SECRET },
    });

    vi.mocked(prisma.channel.findFirst).mockResolvedValue({
      id: "chan_media",
      botId: "bot_media",
      accessToken,
      config: { provider: "meta_cloud" },
      bot: { tenantId: "tenant_media" },
    } as any);

    const imagePayload = generateMetaWebhookPayload({
      from: "447700900000",
      type: "image",
      mediaCaption: "Cool photo",
      messageId: "msg_img_1",
      phoneNumberId,
    });

    const bodyText = JSON.stringify(imagePayload);
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

    expect(messageQueue.add).toHaveBeenCalledWith(
      "whatsapp-message",
      expect.objectContaining({
        type: "whatsapp",
        botId: "bot_media",
        payload: expect.objectContaining({
          inboundText: "[Image] Cool photo",
          channel: expect.objectContaining({
            id: "chan_media",
          }),
        }),
      }),
      expect.anything()
    );
  });
});
