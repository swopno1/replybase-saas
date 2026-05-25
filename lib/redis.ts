import Redis from "ioredis";
import { APP_CONFIG } from "./config";

const isBuild = APP_CONFIG.meta.isBuild;
const isProd = APP_CONFIG.meta.isProd;

const getRedisUrl = () => {
  return APP_CONFIG.infra.redisUrl;
};

// During build, we use a mock to avoid connection errors
const redisInstance = isBuild
  ? (new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === "on") return () => redisInstance;
          if (prop === "quit") return () => Promise.resolve();
          return () => Promise.resolve(null);
        },
      },
    ) as any)
  : new Redis(getRedisUrl(), {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (isProd && times > 3) {
          return null; // Stop retrying in production after 3 attempts
        }
        return Math.min(times * 50, 2000);
      },
    });

let connectionAlerted = false;

if (!isBuild) {
  redisInstance.on("error", (err: any) => {
    // Check if this is a connection refused error (including AggregateError)
    const isRefused =
      err.code === "ECONNREFUSED" ||
      err.message?.includes("ECONNREFUSED") ||
      (Array.isArray(err.errors) &&
        err.errors.some((e: any) => e.code === "ECONNREFUSED"));

    if (isRefused) {
      if (!connectionAlerted) {
        if (isProd) {
          console.error(
            "CRITICAL: Redis connection refused in PRODUCTION. Background jobs (Facebook, WhatsApp, etc.) will NOT work.",
          );
        } else {
          console.warn(
            "⚠️ Redis connection refused. Caching and background jobs will be unavailable locally.",
          );
        }
        connectionAlerted = true;
      }
      return;
    }

    console.error("Redis error:", err);
  });
}

export const redis = redisInstance;
