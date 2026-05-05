import Redis from "ioredis";
import { env } from "./env";

const isBuild = process.env.NEXT_PHASE === "phase-production-build";

const getRedisUrl = () => {
  return process.env.REDIS_URL || "redis://localhost:6379";
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
    });

if (!isBuild) {
  redisInstance.on("error", (err: any) => {
    console.error("Redis error:", err);
  });
}

export const redis = redisInstance;
