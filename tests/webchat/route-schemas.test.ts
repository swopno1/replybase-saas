/**
 * Lightweight Zod schema tests for the three webchat route schemas.
 * The schemas are recreated here matching the actual route definitions
 * so we can test validation rules without involving Next.js / Prisma.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Recreate schemas (mirrors app/api/webchat/*/route.ts exactly)
// ---------------------------------------------------------------------------
const initSchema = z
  .object({
    publicKey: z.string().min(1).optional(),
    channelId: z.string().min(1).optional(),
    botId: z.string().min(1).optional(),
    origin: z.string().url().optional(),
    visitorId: z.string().min(1).optional(),
    visitorContext: z
      .object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      })
      .optional(),
    contact: z
      .object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      })
      .optional(),
    initChallenge: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
    botSignals: z
      .object({
        honeypot: z.string().optional(),
        elapsedMs: z.number().optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.publicKey && !data.channelId && !data.botId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide publicKey, channelId, or botId",
        path: ["publicKey"],
      });
    }
  });

const messageSchema = z.object({
  token: z.string().min(1),
  message: z.string().min(1),
  metadata: z
    .object({
      pageUrl: z.string().url().optional(),
      url: z.string().url().optional(),
      referrer: z.string().url().optional(),
      locale: z.string().optional(),
      pageTitle: z.string().optional(),
      userAgent: z.string().optional(),
      origin: z.string().url().optional(),
      utmSource: z.string().optional(),
      utmMedium: z.string().optional(),
      utmCampaign: z.string().optional(),
      utmTerm: z.string().optional(),
      utmContent: z.string().optional(),
    })
    .optional(),
  botSignals: z
    .object({
      honeypot: z.string().optional(),
      elapsedMs: z.number().optional(),
    })
    .optional(),
});

const eventSchema = z.object({
  token: z.string().min(1),
  type: z.enum(["OPEN", "CLOSE", "TYPING", "ERROR", "MESSAGE"]),
  payload: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Init schema tests
// ---------------------------------------------------------------------------
describe("init schema", () => {
  const validBase = {
    publicKey: "pk_test_123",
    initChallenge: "ch_abc",
  };

  it("accepts a minimal valid payload via publicKey", () => {
    expect(initSchema.safeParse(validBase).success).toBe(true);
  });

  it("accepts a minimal valid payload via channelId", () => {
    const result = initSchema.safeParse({
      channelId: "chan_abc",
      initChallenge: "ch_abc",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a minimal valid payload via botId", () => {
    const result = initSchema.safeParse({
      botId: "bot_xyz",
      initChallenge: "ch_abc",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when none of publicKey / channelId / botId provided", () => {
    const result = initSchema.safeParse({ initChallenge: "ch_abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("Provide publicKey"),
        ),
      ).toBe(true);
    }
  });

  it("rejects missing initChallenge", () => {
    const result = initSchema.safeParse({ publicKey: "pk_abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.includes("initChallenge")),
      ).toBe(true);
    }
  });

  it("rejects empty string initChallenge", () => {
    const result = initSchema.safeParse({
      publicKey: "pk_abc",
      initChallenge: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email in contact", () => {
    const result = initSchema.safeParse({
      ...validBase,
      contact: { email: "not-an-email" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("email"))).toBe(
        true,
      );
    }
  });

  it("accepts valid optional fields", () => {
    const result = initSchema.safeParse({
      ...validBase,
      origin: "https://example.com",
      visitorId: "visitor_123",
      contact: { name: "Alice", email: "alice@example.com", phone: "+1234" },
      metadata: { pageUrl: "https://example.com/page" },
      botSignals: { honeypot: "", elapsedMs: 900 },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Message schema tests
// ---------------------------------------------------------------------------
describe("message schema", () => {
  const validBase = {
    token: "tok_abc",
    message: "Hello, world",
  };

  it("accepts a minimal valid payload", () => {
    expect(messageSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejects missing token", () => {
    const result = messageSchema.safeParse({ message: "Hi" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("token"))).toBe(
        true,
      );
    }
  });

  it("rejects empty token", () => {
    expect(messageSchema.safeParse({ token: "", message: "Hi" }).success).toBe(
      false,
    );
  });

  it("rejects missing message", () => {
    const result = messageSchema.safeParse({ token: "tok_abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("message"))).toBe(
        true,
      );
    }
  });

  it("rejects empty message", () => {
    expect(
      messageSchema.safeParse({ token: "tok_abc", message: "" }).success,
    ).toBe(false);
  });

  it("rejects invalid URL in metadata.pageUrl", () => {
    const result = messageSchema.safeParse({
      ...validBase,
      metadata: { pageUrl: "not-a-url" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid metadata and botSignals", () => {
    const result = messageSchema.safeParse({
      ...validBase,
      metadata: { pageUrl: "https://example.com", locale: "en-US" },
      botSignals: { honeypot: "", elapsedMs: 1200 },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Events schema tests
// ---------------------------------------------------------------------------
describe("events schema", () => {
  const validBase = {
    token: "tok_abc",
    type: "OPEN" as const,
  };

  it("accepts all valid event types", () => {
    for (const type of [
      "OPEN",
      "CLOSE",
      "TYPING",
      "ERROR",
      "MESSAGE",
    ] as const) {
      expect(eventSchema.safeParse({ token: "tok", type }).success).toBe(true);
    }
  });

  it("rejects unknown event type", () => {
    const result = eventSchema.safeParse({
      token: "tok_abc",
      type: "UNKNOWN_TYPE",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("type"))).toBe(
        true,
      );
    }
  });

  it("rejects missing token", () => {
    const result = eventSchema.safeParse({ type: "OPEN" });
    expect(result.success).toBe(false);
  });

  it("rejects empty token", () => {
    expect(eventSchema.safeParse({ token: "", type: "OPEN" }).success).toBe(
      false,
    );
  });

  it("rejects missing type", () => {
    const result = eventSchema.safeParse({ token: "tok_abc" });
    expect(result.success).toBe(false);
  });

  it("accepts optional payload record", () => {
    const result = eventSchema.safeParse({
      ...validBase,
      payload: { pageUrl: "https://example.com", elapsedMs: 1000 },
    });
    expect(result.success).toBe(true);
  });
});
