/**
 * Tests for lib/rate-limit.ts
 *
 * Confirms that:
 *  1. The rate limiter works entirely in-memory when REDIS_URL / Upstash env
 *     vars are absent — no Redis dependency for single-instance deployments.
 *  2. Limits are correctly enforced per scope.
 *  3. Buckets are isolated by scope and by key.
 *  4. The counter resets after the window expires.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

// Prevent APP_CONFIG from blowing up in a test environment.
vi.mock("@/lib/config", () => ({
  APP_CONFIG: {
    meta: { isDev: true, isProd: false, isBuild: false },
    infra: { redisUrl: "redis://localhost:6379" },
  },
}));

// We import the module AFTER mocking so the module-level setInterval fires
// against the already-mocked environment.
const { checkRateLimit } = await import("@/lib/rate-limit");

// ── Helpers ────────────────────────────────────────────────────────────────

let keySeq = 0;
function uniqueKey(prefix = "test"): string {
  return `${prefix}-${++keySeq}-${Math.random().toString(36).slice(2)}`;
}

/** Build a minimal NextRequest; we always pass customKey so IP extraction is bypassed. */
function req(): NextRequest {
  return new NextRequest("http://localhost/test");
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe("checkRateLimit — in-memory path (no Upstash / no REDIS_URL)", () => {
  beforeEach(() => {
    // Ensure Upstash env vars are absent so every test hits the memory path.
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request and returns remaining = limit - 1", async () => {
    const key = uniqueKey();
    const result = await checkRateLimit(req(), "auth", key);

    expect(result.allowed).toBe(true);
    expect(result.limit).toBeGreaterThan(0);
    expect(result.remaining).toBe(result.limit - 1);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("decrements remaining on successive requests", async () => {
    const key = uniqueKey();

    const first = await checkRateLimit(req(), "api", key);
    const second = await checkRateLimit(req(), "api", key);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(first.remaining - 1);
  });

  it("blocks requests once the limit is exhausted", async () => {
    const key = uniqueKey();

    // Exhaust the limit for the auth scope (smallest limit in dev = 100).
    let last = await checkRateLimit(req(), "auth", key);
    while (last.remaining > 0) {
      last = await checkRateLimit(req(), "auth", key);
    }

    const over = await checkRateLimit(req(), "auth", key);
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
    expect(over.retryAfter).toBeGreaterThan(0);
  });

  it("isolates different scopes for the same key", async () => {
    const key = uniqueKey();

    const authResult = await checkRateLimit(req(), "auth", key);
    const webhookResult = await checkRateLimit(req(), "webhook", key);

    // Both first calls are allowed but use different buckets.
    expect(authResult.allowed).toBe(true);
    expect(webhookResult.allowed).toBe(true);
    // Auth and webhook have different limits — counters must be independent.
    expect(authResult.limit).not.toBe(webhookResult.limit);
  });

  it("isolates different keys under the same scope", async () => {
    const keyA = uniqueKey("a");
    const keyB = uniqueKey("b");

    const a = await checkRateLimit(req(), "api", keyA);
    const b = await checkRateLimit(req(), "api", keyB);

    // Each key starts with a fresh counter.
    expect(a.remaining).toBe(b.remaining);
  });

  it("uses the customKey argument instead of extracting IP", async () => {
    const key = uniqueKey("custom");

    // Two calls with the SAME customKey share the same bucket.
    const first = await checkRateLimit(req(), "api", key);
    const second = await checkRateLimit(req(), "api", key);
    expect(second.remaining).toBe(first.remaining - 1);

    // A call with a DIFFERENT customKey gets a fresh bucket.
    const other = await checkRateLimit(req(), "api", uniqueKey("other"));
    expect(other.remaining).toBe(first.remaining);
  });

  it("resets the counter after the window expires", async () => {
    vi.useFakeTimers();

    const key = uniqueKey();

    const first = await checkRateLimit(req(), "auth", key);
    expect(first.allowed).toBe(true);
    const originalLimit = first.limit;

    // Advance past the 60-second window.
    vi.advanceTimersByTime(61_000);

    const afterReset = await checkRateLimit(req(), "auth", key);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(originalLimit - 1);
  });

  it("returns retryAfter reflecting the remaining window time", async () => {
    vi.useFakeTimers();

    const key = uniqueKey();

    await checkRateLimit(req(), "auth", key);

    // Advance halfway through the window.
    vi.advanceTimersByTime(30_000);

    const result = await checkRateLimit(req(), "auth", key);
    // retryAfter should be ≤ 60 s and > 0.
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(60);
  });

  it("covers all defined scopes without throwing", async () => {
    const scopes = ["auth", "webhook", "ai", "api"] as const;

    for (const scope of scopes) {
      const key = uniqueKey(scope);
      const result = await checkRateLimit(req(), scope, key);
      expect(result.limit).toBeGreaterThan(0);
      expect(result.allowed).toBe(true);
    }
  });
});
