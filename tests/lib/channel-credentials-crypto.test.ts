/**
 * Unit tests for lib/channel-credentials-crypto.ts
 * Tests AES-256-GCM encrypt/decrypt round-trip and error cases.
 */
import { describe, it, expect, beforeAll } from "vitest";

// Set a known encryption key before importing the module.
beforeAll(() => {
  process.env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY =
    "test-key-for-unit-tests-32chars!!";
});

import {
  encryptChannelCredentialPayload,
  decryptChannelCredentialPayload,
} from "@/lib/channel-credentials-crypto";

describe("channel-credentials-crypto", () => {
  it("round-trips a plain string payload", () => {
    const original = "hello world";
    const encrypted = encryptChannelCredentialPayload(original);
    expect(encrypted).not.toBe(original);
    expect(decryptChannelCredentialPayload(encrypted)).toBe(original);
  });

  it("round-trips a JSON payload", () => {
    const obj = {
      provider: "meta_cloud",
      credentials: { accessToken: "tok123", phoneNumberId: "456" },
    };
    const payload = JSON.stringify(obj);
    const encrypted = encryptChannelCredentialPayload(payload);
    const decrypted = decryptChannelCredentialPayload(encrypted);
    expect(JSON.parse(decrypted)).toEqual(obj);
  });

  it("produces different ciphertexts for the same input (IV is random)", () => {
    const payload = "same-input";
    const enc1 = encryptChannelCredentialPayload(payload);
    const enc2 = encryptChannelCredentialPayload(payload);
    expect(enc1).not.toBe(enc2);
    expect(decryptChannelCredentialPayload(enc1)).toBe(payload);
    expect(decryptChannelCredentialPayload(enc2)).toBe(payload);
  });

  it("throws on a tampered ciphertext", () => {
    const encrypted = encryptChannelCredentialPayload("sensitive");
    // Corrupt the last byte of the base64 ciphertext portion.
    const parts = encrypted.split(":");
    parts[2] = parts[2].slice(0, -4) + "AAAA";
    expect(() => decryptChannelCredentialPayload(parts.join(":"))).toThrow();
  });

  it("throws on malformed payload (wrong number of segments)", () => {
    expect(() => decryptChannelCredentialPayload("onlyone")).toThrow(
      "Invalid encrypted channel credential payload format",
    );
  });
});
