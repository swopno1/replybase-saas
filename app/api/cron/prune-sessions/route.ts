/**
 * Cron job: Prune expired NextAuth sessions.
 *
 * NextAuth does not auto-delete expired sessions — they just stop being usable
 * but remain in the database. This job removes Session rows whose `expires`
 * timestamp is in the past.
 *
 * Safe to run daily; typical session TTL is 30 days so the table doesn't grow
 * unboundedly without this.
 *
 * Security: requires Authorization: Bearer <CRON_SECRET>.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runPruneSessions();
}

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runPruneSessions();
}

async function runPruneSessions(): Promise<NextResponse> {
  const now = new Date();

  const { count } = await prisma.session.deleteMany({
    where: { expires: { lt: now } },
  });

  console.log(`[prune-sessions] deleted=${count}`);

  return NextResponse.json({ ok: true, deleted: count });
}
