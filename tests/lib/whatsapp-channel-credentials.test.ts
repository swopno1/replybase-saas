/**
 * Unit tests for lib/whatsapp-channel-credentials.ts
 * Tests credential envelope encrypt/decrypt round-trip and validation.
 */
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY =
    "test-key-for-unit-tests-32chars!!";
});

import {
  encryptWhatsAppCredentialEnvelope,
  decryptWhatsAppCredentialEnvelope,
  getStringFromJsonConfig,
} from "@/lib/whatsapp-channel-credentials";
import { encryptChannelCredentialPayload } from "@/lib/channel-credentials-crypto";
import type {
  MetaCloudCredentials,
  TwilioCredentials,
  Dialog360Credentials,
} from "@/lib/whatsapp-provider";

describe("WhatsApp credential envelope", () => {
  it("round-trips Meta Cloud API credentials", () => {
    const creds: MetaCloudCredentials = {
      accessToken: "EAAG-test-token",
      phoneNumberId: "123456789",
      businessAccountId: "987654321",
      appSecret: "secret123456",
    };

    const encrypted = encryptWhatsAppCredentialEnvelope({
      provider: "meta_cloud",
      credentials: creds,
    });

    expect(typeof encrypted).toBe("string");
    expect(encrypted.split(":")).toHaveLength(3);

    const envelope = decryptWhatsAppCredentialEnvelope(encrypted);
    expect(envelope.provider).toBe("meta_cloud");
    expect(envelope.credentials).toEqual(creds);
    expect(envelope.updatedAt).toBeTruthy();
  });

  it("round-trips Twilio credentials", () => {
    const creds: TwilioCredentials = {
      accountSid: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      authToken: "auth-token-test-1234567",
      fromNumber: "+14155238886",
    };

    const encrypted = encryptWhatsAppCredentialEnvelope({
      provider: "twilio",
      credentials: creds,
    });

    const envelope = decryptWhatsAppCredentialEnvelope(encrypted);
    expect(envelope.provider).toBe("twilio");
    expect(envelope.credentials).toEqual(creds);
  });

  it("round-trips 360dialog credentials", () => {
    const creds: Dialog360Credentials = {
      apiKey: "dialog-api-key-test-xyz",
      channelId: "channel-id-test-abc",
    };

    const encrypted = encryptWhatsAppCredentialEnvelope({
      provider: "360dialog",
      credentials: creds,
    });

    const envelope = decryptWhatsAppCredentialEnvelope(encrypted);
    expect(envelope.provider).toBe("360dialog");
    expect(envelope.credentials).toEqual(creds);
  });

  it("throws on invalid (non-envelope) decrypted content", () => {
    // Encrypt a payload that decrypts fine but is not a valid envelope.
    const badPayload = encryptChannelCredentialPayload(
      JSON.stringify({ not: "an envelope" }),
    );
    expect(() => decryptWhatsAppCredentialEnvelope(badPayload)).toThrow(
      "Invalid WhatsApp credential payload",
    );
  });

  it("throws on garbage input", () => {
    expect(() =>
      decryptWhatsAppCredentialEnvelope("not-valid-at-all"),
    ).toThrow();
  });

  it("updatedAt is a valid ISO string within the last few seconds", () => {
    const before = Date.now();
    const encrypted = encryptWhatsAppCredentialEnvelope({
      provider: "meta_cloud",
      credentials: { accessToken: "tok", phoneNumberId: "123" },
    });
    const after = Date.now();
    const envelope = decryptWhatsAppCredentialEnvelope(encrypted);
    const ts = new Date(envelope.updatedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 100);
  });
});

describe("getStringFromJsonConfig", () => {
  it("returns string value for a valid key", () => {
    expect(
      getStringFromJsonConfig(
        { webhookUrl: "https://example.com" },
        "webhookUrl",
      ),
    ).toBe("https://example.com");
  });

  it("returns null for a non-string value", () => {
    expect(getStringFromJsonConfig({ count: 42 }, "count")).toBeNull();
  });

  it("returns null for a missing key", () => {
    expect(getStringFromJsonConfig({ a: "b" }, "missing")).toBeNull();
  });

  it("returns null for a null config object", () => {
    expect(getStringFromJsonConfig(null, "key")).toBeNull();
  });
});
