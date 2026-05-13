import { NextRequest } from "next/server";
import { env } from "./env";
import { APP_CONFIG } from "./config";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfter: number;
};

type CounterState = {
  count: number;
  resetAt: number;
};

type ScopePolicy = {
  limit: number;
  windowMs: number;
};

// Internal memory store
const counters = new Map<string, CounterState>();

const isDev = APP_CONFIG.meta.isDev;

const defaultPolicies: Record<string, ScopePolicy> = {
  auth: { limit: isDev ? 100 : 10, windowMs: 60_000 }, // More permissive in dev
  webhook: { limit: isDev ? 500 : 100, windowMs: 60_000 },
  ai: { limit: isDev ? 100 : 20, windowMs: 60_000 },
  api: { limit: isDev ? 200 : 60, windowMs: 60_000 },
};

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") || "unknown";
}

async function runUpstashCommand(command: Array<string | number>) {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Upstash config missing");
  }

  const path = command.map((part) => encodeURIComponent(String(part))).join("/");
  const response = await fetch(`${env.UPSTASH_REDIS_REST_URL}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Upstash failed: ${response.status}`);
  const payload = await response.json();
  return payload.result;
}

export async function checkRateLimit(
  request: NextRequest,
  scope: keyof typeof defaultPolicies,
  customKey?: string
): Promise<RateLimitResult> {
  const ip = getClientIp(request);
  const key = customKey || ip;
  const bucketKey = `rl:${scope}:${key}`;
  const policy = defaultPolicies[scope];
  const now = Date.now();

  // Try Upstash first if configured
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const count = (await runUpstashCommand(["INCR", bucketKey])) as number;
      if (count === 1) {
        await runUpstashCommand(["PEXPIRE", bucketKey, policy.windowMs]);
      }
      const ttl = (await runUpstashCommand(["PTTL", bucketKey])) as number;
      const retryAfter = Math.max(1, Math.ceil(ttl / 1000));

      return {
        allowed: count <= policy.limit,
        limit: policy.limit,
        remaining: Math.max(0, policy.limit - count),
        retryAfter,
      };
    } catch (e) {
      console.error("[RateLimit] Upstash error, falling back to memory", e);
    }
  }

  // Fallback to memory
  const existing = counters.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    counters.set(bucketKey, { count: 1, resetAt: now + policy.windowMs });
    return {
      allowed: true,
      limit: policy.limit,
      remaining: policy.limit - 1,
      retryAfter: Math.ceil(policy.windowMs / 1000),
    };
  }

  existing.count++;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    allowed: existing.count <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - existing.count),
    retryAfter,
  };
}
