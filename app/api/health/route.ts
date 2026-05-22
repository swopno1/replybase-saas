import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbStatus = "ok";
  let redisStatus = "ok";
  let healthy = true;

  try {
    // Basic connectivity check for Postgres
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error("Health check: Database connection failed", error);
    dbStatus = "error";
    healthy = false;
  }

  try {
    // Basic connectivity check for Redis
    const pong = await redis.ping();
    if (pong !== "PONG") {
      throw new Error("Redis did not respond with PONG");
    }
  } catch (error) {
    console.error("Health check: Redis connection failed", error);
    redisStatus = "error";
    healthy = false;
  }

  const status = healthy ? 200 : 503;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "error",
      service: "saas-app",
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbStatus,
        redis: redisStatus,
      },
    },
    { status }
  );
}
