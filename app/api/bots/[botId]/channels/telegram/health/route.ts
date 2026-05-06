import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/bots/[botId]/channels/telegram/health
 *
 * Public liveness probe for the Telegram integration service.
 * Returns no sensitive information.  Suitable for uptime monitors and
 * load-balancer health checks.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "telegram",
    timestamp: new Date().toISOString(),
  });
}
