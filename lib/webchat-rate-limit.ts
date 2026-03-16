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

export function consumeWebchatRateLimit(input: {
  scope:
    | "init_ip"
    | "message_ip"
    | "message_session"
    | "events_ip"
    | "events_session";
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
