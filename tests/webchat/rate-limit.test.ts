import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  consumeWebchatRateLimit,
  createWebchatRateLimitHeaders,
} from "@/lib/webchat-rate-limit";

// Unique key generator so each test gets its own counter bucket
let __keyCounter = 0;
function uniqueKey(prefix = "test"): string {
  return `${prefix}-${++__keyCounter}-${Math.random().toString(36).slice(2)}`;
}

describe("consumeWebchatRateLimit (in-memory path)", () => {
  beforeEach(() => {
    // Ensure Upstash env vars are absent so we always hit the memory path
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.WEBCHAT_RATE_LIMIT_STORE;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request and returns remaining = limit - 1", async () => {
    const key = uniqueKey();
    const result = await consumeWebchatRateLimit({
      scope: "init_ip",
      key,
    });

    expect(result.allowed).toBe(true);
    expect(result.limit).toBeGreaterThan(0);
    expect(result.remaining).toBe(result.limit - 1);
  });

  it("decrements remaining on successive requests", async () => {
    const key = uniqueKey();

    const first = await consumeWebchatRateLimit({
      scope: "message_session",
      key,
    });
    const second = await consumeWebchatRateLimit({
      scope: "message_session",
      key,
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(first.remaining - 1);
  });

  it("blocks requests once the limit is exhausted", async () => {
    const key = uniqueKey();
    const scope = "init_ip";

    // Burn through the entire limit
    let last = await consumeWebchatRateLimit({ scope, key });
    while (last.remaining > 0) {
      last = await consumeWebchatRateLimit({ scope, key });
    }

    // The very next request should be denied
    const over = await consumeWebchatRateLimit({ scope, key });
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
    expect(over.retryAfter).toBeGreaterThan(0);
  });

  it("different scopes are isolated buckets for the same key", async () => {
    const key = uniqueKey();

    const ipResult = await consumeWebchatRateLimit({
      scope: "message_ip",
      key,
    });
    const sessionResult = await consumeWebchatRateLimit({
      scope: "message_session",
      key,
    });

    // Both should be allowed with full remaining independently
    expect(ipResult.allowed).toBe(true);
    expect(sessionResult.allowed).toBe(true);
    // ip and session scopes may have different limits; they should not share state
    expect(ipResult.limit).not.toEqual(sessionResult.limit);
  });

  it("different keys under the same scope are isolated", async () => {
    const scope = "events_ip" as const;
    const keyA = uniqueKey("a");
    const keyB = uniqueKey("b");

    const a = await consumeWebchatRateLimit({ scope, key: keyA });
    const b = await consumeWebchatRateLimit({ scope, key: keyB });

    expect(a.remaining).toBe(b.remaining);
  });

  it("resets the counter after the window expires", async () => {
    vi.useFakeTimers();

    const key = uniqueKey();
    const scope = "init_ip" as const;

    const first = await consumeWebchatRateLimit({ scope, key });
    expect(first.allowed).toBe(true);
    const limitBeforeReset = first.limit;

    // Advance time past the window (default 60 000 ms)
    vi.advanceTimersByTime(61_000);

    const afterReset = await consumeWebchatRateLimit({ scope, key });
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(limitBeforeReset - 1);
  });

  it("returns correct limit and retryAfter fields", async () => {
    const key = uniqueKey();
    const result = await consumeWebchatRateLimit({
      scope: "events_session",
      key,
    });

    expect(result.limit).toBeGreaterThan(0);
    expect(typeof result.remaining).toBe("number");
    expect(result.retryAfter).toBeGreaterThan(0);
  });
});

describe("createWebchatRateLimitHeaders", () => {
  it("produces correct header string values", () => {
    const headers = createWebchatRateLimitHeaders({
      allowed: true,
      limit: 120,
      remaining: 90,
      retryAfter: 45,
    });

    expect(headers["X-RateLimit-Limit"]).toBe("120");
    expect(headers["X-RateLimit-Remaining"]).toBe("90");
    expect(headers["Retry-After"]).toBe("45");
  });

  it("reports remaining=0 when denied", () => {
    const headers = createWebchatRateLimitHeaders({
      allowed: false,
      limit: 60,
      remaining: 0,
      retryAfter: 30,
    });

    expect(headers["X-RateLimit-Remaining"]).toBe("0");
    expect(headers["Retry-After"]).toBe("30");
  });
});
