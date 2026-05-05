import Redis from "ioredis";
import { env } from "./env";

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const getRedisUrl = () => {
  return process.env.REDIS_URL || "redis://localhost:6379";
};

export const redis = new Redis(getRedisUrl(), redisOptions);

redis.on("error", (err) => {
  console.error("Redis error:", err);
});
