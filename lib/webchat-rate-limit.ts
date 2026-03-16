import { NextRequest } from "next/server";

export type WebchatRateLimitResult = {
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

type WebchatRateLimitScope =
  | "init_ip"
  | "message_ip"
  | "message_session"
  | "events_ip"
  | "events_session";

const counters = new Map<string, CounterState>();

const policies: Record<string, ScopePolicy> = {
  init_ip: {
    limit: getEnvNumber("WEBCHAT_RATE_LIMIT_INIT_IP", 20),
    windowMs: getEnvNumber("WEBCHAT_RATE_LIMIT_INIT_WINDOW_MS", 60_000),
  },
  message_ip: {
    limit: getEnvNumber("WEBCHAT_RATE_LIMIT_MESSAGE_IP", 120),
    windowMs: getEnvNumber("WEBCHAT_RATE_LIMIT_MESSAGE_WINDOW_MS", 60_000),
  },
  message_session: {
    limit: getEnvNumber("WEBCHAT_RATE_LIMIT_MESSAGE_SESSION", 60),
    windowMs: getEnvNumber(
      "WEBCHAT_RATE_LIMIT_MESSAGE_SESSION_WINDOW_MS",
      60_000,
    ),
  },
  events_ip: {
    limit: getEnvNumber("WEBCHAT_RATE_LIMIT_EVENTS_IP", 240),
    windowMs: getEnvNumber("WEBCHAT_RATE_LIMIT_EVENTS_WINDOW_MS", 60_000),
  },
  events_session: {
    limit: getEnvNumber("WEBCHAT_RATE_LIMIT_EVENTS_SESSION", 180),
    windowMs: getEnvNumber(
      "WEBCHAT_RATE_LIMIT_EVENTS_SESSION_WINDOW_MS",
      60_000,
    ),
  },
};

function getEnvNumber(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getPolicy(scope: string): ScopePolicy {
  return policies[scope] || { limit: 60, windowMs: 60_000 };
}

function getStoreMode() {
  const explicit = process.env.WEBCHAT_RATE_LIMIT_STORE?.trim().toLowerCase();
  if (explicit === "memory" || explicit === "upstash") {
    return explicit;
  }

  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return "upstash";
  }

  return "memory";
}

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/+$/, ""),
    token,
  };
}

async function runUpstashCommand(command: Array<string | number>) {
  const config = getUpstashConfig();
  if (!config) {
    throw new Error("Upstash REST config missing");
  }

  const path = command
    .map((part) => encodeURIComponent(String(part)))
    .join("/");
  const response = await fetch(`${config.url}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Upstash command failed: ${response.status} ${responseText}`,
    );
  }

  const payload = (await response.json()) as { result?: unknown };
  return payload.result;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) {
    return cfIp;
  }

  return "unknown";
}

function cleanupCounter(now: number) {
  if (counters.size < 5000) {
    return;
  }

  for (const [key, value] of counters.entries()) {
    if (value.resetAt <= now) {
      counters.delete(key);
    }
  }
}

function consumeInMemoryRateLimit(input: {
  scope: WebchatRateLimitScope;
  key: string;
}): WebchatRateLimitResult {
  const now = Date.now();
  const policy = getPolicy(input.scope);
  const bucketKey = `${input.scope}:${input.key}`;

  cleanupCounter(now);

  const existing = counters.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    counters.set(bucketKey, {
      count: 1,
      resetAt: now + policy.windowMs,
    });

    return {
      allowed: true,
      limit: policy.limit,
      remaining: policy.limit - 1,
      retryAfter: Math.ceil(policy.windowMs / 1000),
    };
  }

  if (existing.count >= policy.limit) {
    return {
      allowed: false,
      limit: policy.limit,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  counters.set(bucketKey, existing);

  return {
    allowed: true,
    limit: policy.limit,
    remaining: Math.max(policy.limit - existing.count, 0),
    retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

async function consumeUpstashRateLimit(input: {
  scope: WebchatRateLimitScope;
  key: string;
}): Promise<WebchatRateLimitResult> {
  const now = Date.now();
  const policy = getPolicy(input.scope);
  const bucketKey = `webchat:rl:${input.scope}:${input.key}`;

  const incrementResult = await runUpstashCommand(["INCR", bucketKey]);
  const count = Number(incrementResult || 0);

  if (!Number.isFinite(count) || count <= 0) {
    throw new Error("Invalid counter response from Upstash");
  }

  if (count === 1) {
    await runUpstashCommand(["PEXPIRE", bucketKey, policy.windowMs]);
  }

  const pttlResult = await runUpstashCommand(["PTTL", bucketKey]);
  const ttlMs = Number(pttlResult);
  const effectiveTtlMs =
    Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : policy.windowMs;

  if (count > policy.limit) {
    return {
      allowed: false,
      limit: policy.limit,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil(effectiveTtlMs / 1000)),
    };
  }

  return {
    allowed: true,
    limit: policy.limit,
    remaining: Math.max(policy.limit - count, 0),
    retryAfter: Math.max(1, Math.ceil(effectiveTtlMs / 1000)),
  };
}

export async function consumeWebchatRateLimit(input: {
  scope: WebchatRateLimitScope;
  key: string;
}): Promise<WebchatRateLimitResult> {
  const mode = getStoreMode();

  if (mode === "upstash") {
    try {
      return await consumeUpstashRateLimit(input);
    } catch (error) {
      console.error(
        "[Webchat RateLimit] Shared limiter unavailable, falling back to memory:",
        error,
      );
    }
  }

  return consumeInMemoryRateLimit(input);
}

export function getWebchatLimiterKeyFromRequest(request: NextRequest) {
  return getClientIp(request);
}

export function createWebchatRateLimitHeaders(result: WebchatRateLimitResult) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "Retry-After": String(result.retryAfter),
  };
}
