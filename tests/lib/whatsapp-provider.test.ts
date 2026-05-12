/**
 * Unit tests for lib/whatsapp-provider.ts
 * Tests pure utility functions — no network calls, no DB.
 */
import { describe, it, expect, beforeAll, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

beforeAll(() => {
  process.env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY =
    "test-key-for-unit-tests-32chars!!";
});

import {
  normalizeWhatsAppAddress,
  normalizeWhatsAppE164,
  maskSecret,
  verifyTwilioSignature,
  validateWhatsAppProviderConnection,
  sendWhatsAppText,
} from "@/lib/whatsapp-provider";

// ---------------------------------------------------------------------------
// normalizeWhatsAppAddress
// ---------------------------------------------------------------------------
describe("normalizeWhatsAppAddress", () => {
  it("strips whatsapp: prefix", () => {
    expect(normalizeWhatsAppAddress("whatsapp:+14155238886")).toBe(
      "+14155238886",
    );
  });

  it("strips WhatsApp: prefix (case-insensitive)", () => {
    expect(normalizeWhatsAppAddress("WhatsApp:+14155238886")).toBe(
      "+14155238886",
    );
  });

  it("strips non-digit, non-plus characters", () => {
    expect(normalizeWhatsAppAddress("+1 (415) 523-8886")).toBe("+14155238886");
  });

  it("preserves a clean E.164 number", () => {
    expect(normalizeWhatsAppAddress("+14155238886")).toBe("+14155238886");
  });

  it("strips spaces from a number without plus", () => {
    expect(normalizeWhatsAppAddress("1 415 523 8886")).toBe("14155238886");
  });
});

// ---------------------------------------------------------------------------
// normalizeWhatsAppE164
// ---------------------------------------------------------------------------
describe("normalizeWhatsAppE164", () => {
  it("adds + prefix when missing", () => {
    expect(normalizeWhatsAppE164("14155238886")).toBe("+14155238886");
  });

  it("does not double-add + prefix", () => {
    expect(normalizeWhatsAppE164("+14155238886")).toBe("+14155238886");
  });

  it("strips whatsapp: prefix and adds +", () => {
    expect(normalizeWhatsAppE164("whatsapp:14155238886")).toBe("+14155238886");
  });
});

// ---------------------------------------------------------------------------
// maskSecret
// ---------------------------------------------------------------------------
describe("maskSecret", () => {
  it("returns null for null input", () => {
    expect(maskSecret(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(maskSecret(undefined)).toBeNull();
  });

  it("returns eight stars for short secrets (<= 8 chars)", () => {
    expect(maskSecret("abc123")).toBe("********");
    expect(maskSecret("12345678")).toBe("********");
  });

  it("shows first 4 and last 4 with ellipsis for longer secrets", () => {
    expect(maskSecret("EAAG1234567890ABCD")).toBe("EAAG...ABCD");
  });

  it("handles exactly 9-char secrets", () => {
    expect(maskSecret("123456789")).toBe("1234...6789");
  });
});

// ---------------------------------------------------------------------------
// verifyTwilioSignature
// ---------------------------------------------------------------------------

function buildTwilioSignature(
  authToken: string,
  url: string,
  values: URLSearchParams,
): string {
  const entries = Array.from(values.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const payload = url + entries.map(([k, v]) => `${k}${v}`).join("");
  return crypto
    .createHmac("sha1", authToken)
    .update(payload, "utf8")
    .digest("base64");
}

describe("verifyTwilioSignature", () => {
  const authToken = "test_auth_token_abc123";
  const url = "https://app.example.com/api/whatsapp/webhook";
  const params = new URLSearchParams({
    Body: "Hello",
    From: "whatsapp:+14155238886",
    To: "whatsapp:+14155551234",
    MessageSid: "SM123456789",
  });

  it("accepts a valid signature", () => {
    const sig = buildTwilioSignature(authToken, url, params);
    expect(
      verifyTwilioSignature({ authToken, signature: sig, url, values: params }),
    ).toBe(true);
  });

  it("rejects a tampered signature", () => {
    expect(
      verifyTwilioSignature({
        authToken,
        signature: "AAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        url,
        values: params,
      }),
    ).toBe(false);
  });

  it("rejects null signature", () => {
    expect(
      verifyTwilioSignature({
        authToken,
        signature: null,
        url,
        values: params,
      }),
    ).toBe(false);
  });

  it("rejects when URL does not match", () => {
    const sig = buildTwilioSignature(authToken, url, params);
    expect(
      verifyTwilioSignature({
        authToken,
        signature: sig,
        url: "https://attacker.example.com/api/whatsapp/webhook",
        values: params,
      }),
    ).toBe(false);
  });

  it("rejects when payload differs", () => {
    const sig = buildTwilioSignature(authToken, url, params);
    const tamperedParams = new URLSearchParams(params);
    tamperedParams.set("Body", "Injected content");
    expect(
      verifyTwilioSignature({
        authToken,
        signature: sig,
        url,
        values: tamperedParams,
      }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateWhatsAppProviderConnection
// ---------------------------------------------------------------------------
describe("validateWhatsAppProviderConnection", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    return () => {
      vi.unstubAllGlobals();
    };
  });

  describe("meta_cloud", () => {
    const credentials = {
      accessToken: "test_token",
      phoneNumberId: "123456789",
    };

    it("returns valid: true on success", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "123456789" }),
      });

      const result = await validateWhatsAppProviderConnection({
        provider: "meta_cloud",
        credentials,
      });

      expect(result).toEqual({
        valid: true,
        normalized: { phoneNumberId: "123456789" },
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("123456789"),
        expect.objectContaining({
          headers: { Authorization: "Bearer test_token" },
        }),
      );
    });

    it("returns error message from Meta on failure", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({ error: { message: "Invalid OAuth access token" } }),
      });

      const result = await validateWhatsAppProviderConnection({
        provider: "meta_cloud",
        credentials,
      });

      expect(result).toEqual({
        valid: false,
        error: "Invalid OAuth access token",
      });
    });

    it("returns fallback error message if data is not an object", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve("Just a string"),
      });

      const result = await validateWhatsAppProviderConnection({
        provider: "meta_cloud",
        credentials,
      });

      expect(result).toEqual({
        valid: false,
        error: "Failed to validate Meta Cloud API credentials",
      });
    });

    it("returns fallback error message if JSON is an empty object", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await validateWhatsAppProviderConnection({
        provider: "meta_cloud",
        credentials,
      });

      expect(result).toEqual({
        valid: false,
        error: "Failed to validate Meta Cloud API credentials",
      });
    });

    it("returns fallback error message if JSON is malformed", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new Error("Bad JSON")),
      });

      const result = await validateWhatsAppProviderConnection({
        provider: "meta_cloud",
        credentials,
      });

      expect(result).toEqual({
        valid: false,
        error: "Failed to validate Meta Cloud API credentials",
      });
    });
  });

  describe("twilio", () => {
    const credentials = {
      accountSid: "AC123",
      authToken: "secret",
      fromNumber: "14155238886",
    };

    it("returns valid: true on success", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sid: "AC123" }),
      });

      const result = await validateWhatsAppProviderConnection({
        provider: "twilio",
        credentials,
      });

      expect(result).toEqual({
        valid: true,
        normalized: { fromNumber: "+14155238886" },
      });
      const auth = Buffer.from("AC123:secret").toString("base64");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("AC123.json"),
        expect.objectContaining({
          headers: { Authorization: `Basic ${auth}` },
        }),
      );
    });

    it("returns error message from Twilio on failure", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: "Authentication Error" }),
      });

      const result = await validateWhatsAppProviderConnection({
        provider: "twilio",
        credentials,
      });

      expect(result).toEqual({
        valid: false,
        error: "Authentication Error",
      });
    });
  });

  describe("360dialog", () => {
    const credentials = {
      apiKey: "d360_key",
      channelId: "chan_123",
    };

    it("returns valid: true on success", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await validateWhatsAppProviderConnection({
        provider: "360dialog",
        credentials,
      });

      expect(result).toEqual({
        valid: true,
        normalized: { channelId: "chan_123" },
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v2/contacts"),
        expect.objectContaining({
          headers: { "D360-API-KEY": "d360_key" },
        }),
      );
    });

    it("returns fallback error if response is not ok", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve(null),
      });

      const result = await validateWhatsAppProviderConnection({
        provider: "360dialog",
        credentials,
      });

      expect(result).toEqual({
        valid: false,
        error: "Failed to validate 360dialog credentials",
      });
    });
  });
});

// ---------------------------------------------------------------------------
// sendWhatsAppText
// ---------------------------------------------------------------------------
describe("sendWhatsAppText", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    return () => {
      vi.unstubAllGlobals();
    };
  });

  it("sends a Meta Cloud text message successfully", async () => {
    const input = {
      provider: "meta_cloud" as const,
      credentials: {
        accessToken: "test_token",
        phoneNumberId: "12345",
      },
      to: "1234567890",
      text: "Hello Meta",
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: "wam_123" }] }),
    });

    const result = await sendWhatsAppText(input);

    expect(result).toEqual({
      success: true,
      providerMessageId: "wam_123",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/12345/messages"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test_token",
        }),
        body: expect.stringContaining("Hello Meta"),
      }),
    );
  });

  it("sends a Twilio text message successfully", async () => {
    const input = {
      provider: "twilio" as const,
      credentials: {
        accountSid: "AC123",
        authToken: "secret",
        fromNumber: "14155238886",
      },
      to: "1234567890",
      text: "Hello Twilio",
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sid: "SM123" }),
    });

    const result = await sendWhatsAppText(input);

    expect(result).toEqual({
      success: true,
      providerMessageId: "SM123",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("AC123/Messages.json"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/x-www-form-urlencoded",
        }),
        body: expect.stringContaining("Hello+Twilio"),
      }),
    );
  });

  it("sends a 360dialog text message successfully", async () => {
    const input = {
      provider: "360dialog" as const,
      credentials: {
        apiKey: "d360_key",
        channelId: "chan_123",
      },
      to: "1234567890",
      text: "Hello 360",
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: "d360_123" }] }),
    });

    const result = await sendWhatsAppText(input);

    expect(result).toEqual({
      success: true,
      providerMessageId: "d360_123",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/messages"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "D360-API-KEY": "d360_key",
        }),
        body: expect.stringContaining("Hello 360"),
      }),
    );
  });
});
