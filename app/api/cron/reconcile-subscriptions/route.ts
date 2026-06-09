/**
 * Cron job: Reconcile all active subscriptions against Stripe.
 *
 * Safety net for missed webhooks. Iterates every ACTIVE / TRIALING / PAST_DUE
 * subscription, re-fetches it from Stripe, and syncs status + plan to the DB.
 *
 * Runs daily at 04:00 UTC — after Stripe's own nightly invoice processing.
 * Will take longer as tenant count grows; increase timeout if needed.
 *
 * Security: requires Authorization: Bearer <CRON_SECRET>.
 */

import { NextResponse } from "next/server";
import { reconcileSubscriptions } from "@/lib/billing-service";
import { isCronAuthorized } from "@/lib/cron-auth";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

// Give the reconciliation job enough time to iterate all tenants
export const maxDuration = 300; // 5 minutes (Vercel Pro/Enterprise)

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run();
}

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run();
}

async function run(): Promise<NextResponse> {
  const start = Date.now();
  logger.info("[reconcile-subscriptions] Starting daily reconciliation");

  try {
    await reconcileSubscriptions();
    const elapsed = Date.now() - start;
    logger.info({ elapsed }, "[reconcile-subscriptions] Completed");
    return NextResponse.json({ ok: true, elapsedMs: elapsed });
  } catch (error) {
    logger.error({ error }, "[reconcile-subscriptions] Failed");
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}
