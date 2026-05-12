import { describe, it, expect, vi, beforeEach } from "vitest";
import { messageQueue } from "@/lib/queue";
import { POST as whatsappWebhook } from "@/app/api/whatsapp/webhook/route";
import { NextRequest } from "next/server";
import { generateMetaWebhookPayload } from "../../utils/whatsapp-sim";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/whatsapp-channel-credentials", () => ({
  decryptWhatsAppCredentialEnvelope: vi.fn().mockReturnValue({
    provider: "meta_cloud",
    credentials: { accessToken: "tok", phoneNumberId: "123" },
  }),
  getStringFromJsonConfig: vi.fn().mockReturnValue("meta_cloud"),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    channel: {
      findFirst: vi.fn(),
    },
    webhookLog: {
      create: vi.fn().mockReturnValue({ catch: vi.fn() }),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/queue", () => ({
  messageQueue: {
    add: vi.fn().mockImplementation(() => Promise.resolve({ id: "job_id" })),
  },
}));

vi.mock("@/lib/whatsapp-provider", () => ({
  normalizeWhatsAppE164: vi.fn((v) => v),
  verifyWebhookSignature: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/channel-config", () => ({
  isChannelEnabled: vi.fn().mockReturnValue(true),
}));

describe("Omnichannel Stress & Burst Testing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY = "00000000000000000000000000000000"; // 32 chars
  });

  it("should handle a burst of concurrent webhooks without losing events", async () => {
    const CONCURRENT_REQUESTS = 50;
    const channelId = "phone_burst_123";

    vi.mocked(prisma.channel.findFirst).mockResolvedValue({
      id: "chan_1",
      botId: "bot_1",
      accessToken: "encrypted_token",
      bot: { tenantId: "tenant_1" },
      config: { provider: "meta_cloud" },
    } as any);

    const requests = Array.from({ length: CONCURRENT_REQUESTS }).map((_, i) => {
      const payload = generateMetaWebhookPayload({
        from: `4477009000${i.toString().padStart(2, "0")}`,
        body: `Burst message ${i}`,
        messageId: `wamid.burst.${i}`,
        phoneNumberId: channelId,
      });

      return new NextRequest("http://localhost/api/whatsapp/webhook", {
        method: "POST",
        headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=valid" },
        body: JSON.stringify(payload),
      });
    });

    // Execute all requests concurrently
    const start = Date.now();
    const responses = await Promise.all(requests.map((req) => whatsappWebhook(req)));
    const duration = Date.now() - start;

    console.log(`Processed ${CONCURRENT_REQUESTS} webhooks in ${duration}ms`);

    // Verify all returned 200
    responses.forEach((res) => expect(res.status).toBe(200));

    // Verify all messages were added to the queue
    expect(messageQueue.add).toHaveBeenCalledTimes(CONCURRENT_REQUESTS);
  });
});
