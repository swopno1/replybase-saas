import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  sanitizeWebchatMetadataForRetention,
  sanitizeWebchatContactForRetention,
  getWebchatPiiRetentionMode,
} from "@/lib/webchat-privacy";

function withMode(mode: string, fn: () => void) {
  const prev = process.env.WEBCHAT_PII_RETENTION_MODE;
  process.env.WEBCHAT_PII_RETENTION_MODE = mode;
  try {
    fn();
  } finally {
    if (prev === undefined) {
      delete process.env.WEBCHAT_PII_RETENTION_MODE;
    } else {
      process.env.WEBCHAT_PII_RETENTION_MODE = prev;
    }
  }
}

describe("getWebchatPiiRetentionMode", () => {
  afterEach(() => {
    delete process.env.WEBCHAT_PII_RETENTION_MODE;
  });

  it("defaults to retain", () => {
    delete process.env.WEBCHAT_PII_RETENTION_MODE;
    expect(getWebchatPiiRetentionMode()).toBe("retain");
  });

  it("reads mask mode", () => {
    process.env.WEBCHAT_PII_RETENTION_MODE = "mask";
    expect(getWebchatPiiRetentionMode()).toBe("mask");
  });

  it("reads drop mode", () => {
    process.env.WEBCHAT_PII_RETENTION_MODE = "drop";
    expect(getWebchatPiiRetentionMode()).toBe("drop");
  });

  it("falls back to retain for unknown values", () => {
    process.env.WEBCHAT_PII_RETENTION_MODE = "unknown_mode";
    expect(getWebchatPiiRetentionMode()).toBe("retain");
  });
});

describe("sanitizeWebchatMetadataForRetention", () => {
  describe("retain mode (default)", () => {
    it("returns the input unchanged", () => {
      const input = {
        email: "user@example.com",
        pageUrl: "https://example.com",
      };
      expect(sanitizeWebchatMetadataForRetention(input)).toEqual(input);
    });

    it("returns null/undefined unchanged", () => {
      expect(sanitizeWebchatMetadataForRetention(null)).toBeNull();
      expect(sanitizeWebchatMetadataForRetention(undefined)).toBeUndefined();
    });
  });

  describe("mask mode", () => {
    it("redacts string PII fields", () => {
      withMode("mask", () => {
        const result = sanitizeWebchatMetadataForRetention({
          email: "user@example.com",
          name: "Alice Smith",
          pageUrl: "https://example.com",
          locale: "en-US",
        });
        expect(result).toMatchObject({
          email: "[redacted]",
          name: "[redacted]",
          pageUrl: "https://example.com",
          locale: "en-US",
        });
      });
    });

    it("redacts numeric PII fields to 0", () => {
      withMode("mask", () => {
        const result = sanitizeWebchatMetadataForRetention({ phone: 123456 });
        expect((result as Record<string, unknown>).phone).toBe(0);
      });
    });

    it("redacts boolean PII fields to false", () => {
      withMode("mask", () => {
        const result = sanitizeWebchatMetadataForRetention({
          fingerprint: true,
        });
        expect((result as Record<string, unknown>).fingerprint).toBe(false);
      });
    });

    it("preserves non-PII fields", () => {
      withMode("mask", () => {
        const result = sanitizeWebchatMetadataForRetention({
          pageUrl: "https://example.com",
          utmSource: "google",
        });
        expect((result as Record<string, unknown>).pageUrl).toBe(
          "https://example.com",
        );
        expect((result as Record<string, unknown>).utmSource).toBe("google");
      });
    });

    it("recursively masks nested PII", () => {
      withMode("mask", () => {
        const result = sanitizeWebchatMetadataForRetention({
          visitor: { name: "Bob", pageUrl: "https://example.com" },
        });
        const visitor = (result as Record<string, unknown>).visitor as Record<
          string,
          unknown
        >;
        expect(visitor.name).toBe("[redacted]");
        expect(visitor.pageUrl).toBe("https://example.com");
      });
    });

    it("handles null/undefined gracefully", () => {
      withMode("mask", () => {
        expect(sanitizeWebchatMetadataForRetention(null)).toBeNull();
        expect(sanitizeWebchatMetadataForRetention(undefined)).toBeUndefined();
        expect(sanitizeWebchatMetadataForRetention("plain string")).toBe(
          "plain string",
        );
      });
    });

    it("processes arrays", () => {
      withMode("mask", () => {
        const result = sanitizeWebchatMetadataForRetention([
          { email: "x@y.com", pageUrl: "https://example.com" },
          { email: "a@b.com", locale: "fr" },
        ]);
        const arr = result as Array<Record<string, unknown>>;
        expect(arr[0].email).toBe("[redacted]");
        expect(arr[0].pageUrl).toBe("https://example.com");
        expect(arr[1].email).toBe("[redacted]");
      });
    });
  });

  describe("drop mode", () => {
    it("removes PII fields entirely", () => {
      withMode("drop", () => {
        const result = sanitizeWebchatMetadataForRetention({
          email: "user@example.com",
          name: "Alice",
          pageUrl: "https://example.com",
          locale: "en-US",
        });
        const r = result as Record<string, unknown>;
        expect("email" in r).toBe(false);
        expect("name" in r).toBe(false);
        expect(r.pageUrl).toBe("https://example.com");
        expect(r.locale).toBe("en-US");
      });
    });

    it("recursively drops nested PII", () => {
      withMode("drop", () => {
        const result = sanitizeWebchatMetadataForRetention({
          visitor: { email: "x@y.com", pageUrl: "https://example.com" },
        });
        const visitor = (result as Record<string, unknown>).visitor as Record<
          string,
          unknown
        >;
        expect("email" in visitor).toBe(false);
        expect(visitor.pageUrl).toBe("https://example.com");
      });
    });
  });
});

describe("sanitizeWebchatContactForRetention", () => {
  afterEach(() => {
    delete process.env.WEBCHAT_PII_RETENTION_MODE;
  });

  it("retain: passes through all contact fields", () => {
    const contact = {
      name: "Alice",
      email: "alice@example.com",
      phone: "+1234",
    };
    const result = sanitizeWebchatContactForRetention(contact);
    expect(result).toEqual(contact);
  });

  it("mask: replaces all contact fields with [redacted]", () => {
    process.env.WEBCHAT_PII_RETENTION_MODE = "mask";
    const result = sanitizeWebchatContactForRetention({
      name: "Alice",
      email: "alice@example.com",
      phone: "+1234",
    });
    expect(result).toEqual({
      name: "[redacted]",
      email: "[redacted]",
      phone: "[redacted]",
    });
  });

  it("mask: preserves undefined contact fields as undefined", () => {
    process.env.WEBCHAT_PII_RETENTION_MODE = "mask";
    const result = sanitizeWebchatContactForRetention({ name: "Alice" });
    expect(result?.email).toBeUndefined();
    expect(result?.phone).toBeUndefined();
    expect(result?.name).toBe("[redacted]");
  });

  it("drop: returns undefined (drops entire contact)", () => {
    process.env.WEBCHAT_PII_RETENTION_MODE = "drop";
    const result = sanitizeWebchatContactForRetention({
      name: "Alice",
      email: "alice@example.com",
    });
    expect(result).toBeUndefined();
  });

  it("returns undefined when input is undefined", () => {
    expect(sanitizeWebchatContactForRetention(undefined)).toBeUndefined();
  });
});
