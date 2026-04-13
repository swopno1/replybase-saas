/**
 * Unit tests for lib/whatsapp-provider.ts
 * Tests pure utility functions — no network calls, no DB.
 */
import { describe, it, expect, beforeAll } from "vitest";
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
