/**
 * Unit tests for the 24-hour service window logic in
 * lib/conversation-channel-delivery.ts
 *
 * We test the window detection logic by mocking Prisma and the
 * whatsapp-provider / whatsapp-channel-credentials modules so no real
 * network or DB calls are made.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY =
    "test-key-for-unit-tests-32chars!!";
  process.env.AUTH_SECRET = "auth-secret-fallback";
});

// ---- Module mocks --------------------------------------------------------
vi.mock("@/lib/prisma", () => ({
  prisma: {
    channel: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/whatsapp-channel-credentials", () => ({
  decryptWhatsAppCredentialEnvelope: vi.fn(),
}));

vi.mock("@/lib/whatsapp-provider", () => ({
  normalizeWhatsAppAddress: vi.fn((v: string) => v),
  sendWhatsAppText: vi.fn(),
}));

// ---- Imports after mocks -------------------------------------------------
import { prisma } from "@/lib/prisma";
import { decryptWhatsAppCredentialEnvelope } from "@/lib/whatsapp-channel-credentials";
import { sendWhatsAppText } from "@/lib/whatsapp-provider";
import { deliverConversationMessage } from "@/lib/conversation-channel-delivery";

// ---- Test helpers --------------------------------------------------------
function makeConversation(
  overrides: {
    channel?: string;
    botId?: string | null;
    lastInboundAt?: Date | null;
    waId?: string;
  } = {},
) {
  const lastInboundAt = overrides.lastInboundAt ?? new Date();
  const metadata =
    lastInboundAt !== null
      ? { whatsapp: { lastInboundAt: lastInboundAt.toISOString() } }
      : null;

  return {
    id: "conv_test",
    channel: overrides.channel ?? "whatsapp",
    botId: overrides.botId ?? "bot_test",
    metadata,
    contact: {
      phone: "+14155238886",
      identities: overrides.waId
        ? [{ type: "whatsapp_wa_id", value: overrides.waId }]
        : [],
    },
  };
}

const MOCK_CHANNEL = { id: "ch_test", accessToken: "encrypted_credentials" };
const MOCK_ENVELOPE = {
  provider: "meta_cloud" as const,
  credentials: { accessToken: "tok", phoneNumberId: "123" },
};

// ---------------------------------------------------------------------------

describe("deliverConversationMessage — channel guard", () => {
  it("returns success:true immediately for non-whatsapp channels", async () => {
    const result = await deliverConversationMessage({
      conversation: makeConversation({ channel: "telegram" }),
      content: "hello",
    });
    expect(result).toEqual({ success: true });
  });

  it("returns not_configured when botId is null", async () => {
    const result = await deliverConversationMessage({
      conversation: makeConversation({ botId: null }),
      content: "hello",
    });
    expect(result).toMatchObject({ success: false, code: "not_configured" });
  });
});

describe("deliverConversationMessage — channel lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_configured when channel is not found", async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(null);
    const result = await deliverConversationMessage({
      conversation: makeConversation(),
      content: "hello",
    });
    expect(result).toMatchObject({ success: false, code: "not_configured" });
  });

  it("returns not_configured when channel has no accessToken", async () => {
    vi.mocked(prisma.channel.findFirst).mockResolvedValue({
      id: "ch_test",
      accessToken: null,
    } as never);
    const result = await deliverConversationMessage({
      conversation: makeConversation(),
      content: "hello",
    });
    expect(result).toMatchObject({ success: false, code: "not_configured" });
  });
});

describe("deliverConversationMessage — 24-hour window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(
      MOCK_CHANNEL as never,
    );
    vi.mocked(decryptWhatsAppCredentialEnvelope).mockReturnValue(
      MOCK_ENVELOPE as never,
    );
  });

  it("allows delivery when inbound was <24h ago", async () => {
    vi.mocked(sendWhatsAppText).mockResolvedValue({
      success: true,
      providerMessageId: "msg_1",
    });

    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);
    const result = await deliverConversationMessage({
      conversation: makeConversation({
        lastInboundAt: twentyThreeHoursAgo,
        waId: "14155238886",
      }),
      content: "reply within window",
    });
    expect(result).toMatchObject({ success: true });
    expect(sendWhatsAppText).toHaveBeenCalledOnce();
  });

  it("blocks delivery when inbound was >24h ago", async () => {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const result = await deliverConversationMessage({
      conversation: makeConversation({
        lastInboundAt: twentyFiveHoursAgo,
        waId: "14155238886",
      }),
      content: "late reply",
    });
    expect(result).toMatchObject({ success: false, code: "outside_window" });
    expect(sendWhatsAppText).not.toHaveBeenCalled();
  });

  it("blocks delivery at exactly 24h boundary (>= boundary)", async () => {
    // Exactly 24h + 1ms past should be blocked.
    const exactBoundary = new Date(Date.now() - 24 * 60 * 60 * 1000 - 1);
    const result = await deliverConversationMessage({
      conversation: makeConversation({
        lastInboundAt: exactBoundary,
        waId: "14155238886",
      }),
      content: "boundary test",
    });
    expect(result).toMatchObject({ success: false, code: "outside_window" });
    expect(sendWhatsAppText).not.toHaveBeenCalled();
  });

  it("allows delivery when metadata has no lastInboundAt (skip window check)", async () => {
    // If lastInboundAt is missing we skip the window check (can't know when
    // the conversation started — best to allow the send).
    vi.mocked(sendWhatsAppText).mockResolvedValue({ success: true });

    const result = await deliverConversationMessage({
      conversation: makeConversation({
        lastInboundAt: null,
        waId: "14155238886",
      }),
      content: "no metadata window",
    });
    expect(result).toMatchObject({ success: true });
    expect(sendWhatsAppText).toHaveBeenCalledOnce();
  });
});

describe("deliverConversationMessage — recipient resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.channel.findFirst).mockResolvedValue(
      MOCK_CHANNEL as never,
    );
    vi.mocked(decryptWhatsAppCredentialEnvelope).mockReturnValue(
      MOCK_ENVELOPE as never,
    );
  });

  it("returns not_configured when contact has no waId or phone", async () => {
    const conv = {
      id: "c",
      channel: "whatsapp",
      botId: "b",
      metadata: null,
      contact: { phone: null, identities: [] },
    };
    const result = await deliverConversationMessage({
      conversation: conv,
      content: "hi",
    });
    expect(result).toMatchObject({ success: false, code: "not_configured" });
  });

  it("returns send_failed when provider returns error", async () => {
    vi.mocked(sendWhatsAppText).mockResolvedValue({
      success: false,
      error: "Meta API rejected the request",
    });

    const result = await deliverConversationMessage({
      conversation: makeConversation({ waId: "14155238886" }),
      content: "fail me",
    });
    expect(result).toMatchObject({ success: false, code: "send_failed" });
  });
});
