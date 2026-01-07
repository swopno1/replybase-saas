import { NextRequest, NextResponse } from "next/server";
import { checkLimit, incrementUsage } from "./subscription";
import { getServerSession } from "next-auth";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfter?: number;
}

/**
 * Rate limit middleware for API routes
 */
export async function rateLimitMiddleware(
  req: NextRequest,
  type: "message" | "flow_execution",
  botId?: string,
  channelId?: string
): Promise<RateLimitResult | null> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
      };
    }

    const userId = (session.user as any).id;
    const limitCheck = await checkLimit(userId, type);

    if (limitCheck.allowed) {
      // Increment usage asynchronously (don't wait)
      incrementUsage(userId, type, 1, botId, channelId).catch(console.error);
    }

    return limitCheck;
  } catch (error) {
    console.error("[RateLimit] Error:", error);
    // Fail open in case of errors (don't block requests)
    return {
      allowed: true,
      remaining: 999999,
      limit: 999999,
    };
  }
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(
  rateLimit: RateLimitResult
): NextResponse {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", rateLimit.limit.toString());
  headers.set("X-RateLimit-Remaining", rateLimit.remaining.toString());

  if (rateLimit.retryAfter) {
    headers.set("Retry-After", rateLimit.retryAfter.toString());
  }

  return NextResponse.json(
    {
      error: "Rate limit exceeded",
      message: `You have exceeded your ${rateLimit.limit} requests limit. Please try again later.`,
      limit: rateLimit.limit,
      remaining: rateLimit.remaining,
      retryAfter: rateLimit.retryAfter,
    },
    {
      status: 429,
      headers,
    }
  );
}

import { prisma } from "./prisma";
import { authOptions } from "./auth";

/**
 * Check channel kill switch
 */
export async function isChannelKillSwitchEnabled(
  botId: string,
  channelType: string,
  channelId: string
): Promise<boolean> {
  const channel = await prisma.botChannel.findFirst({
    where: {
      botId,
      type: channelType,
      channelId,
    },
    select: {
      killSwitch: true,
      enabled: true,
    },
  });

  return channel?.killSwitch === true || channel?.enabled === false;
}
