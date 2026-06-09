/**
 * Cron job: Handle expired free-plan trials.
 *
 * Runs daily AFTER the trial-reminders job (schedule: 0 9 * * *).
 * Finds tenants whose trialEndsAt has passed and who are still on the free plan.
 * For each:
 *   1. Disables all their bots (sets active = false).
 *   2. Writes an ActivityLog entry "trial_expired" (idempotent — skips if already written).
 *
 * Security: requires Authorization: Bearer <CRON_SECRET>.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/cron-auth";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runExpiredTrials();
}

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runExpiredTrials();
}

async function runExpiredTrials(): Promise<NextResponse> {
  const now = new Date();

  const freePlan = await prisma.plan.findUnique({ where: { name: "free" } });
  if (!freePlan) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      note: "No free plan found",
    });
  }

  // Tenants on free plan whose trial has now passed.
  const expiredSubscriptions = await prisma.subscription.findMany({
    where: {
      planId: freePlan.id,
      trialEndsAt: { lte: now },
    },
    select: {
      tenantId: true,
      trialEndsAt: true,
    },
  });

  const tenantIds = expiredSubscriptions.map((sub) => sub.tenantId);

  // Pre-fetch all handled events for these tenants to avoid N+1 queries.
  const handledLogs = await prisma.activityLog.findMany({
    where: {
      tenantId: { in: tenantIds },
      type: "trial_expired",
    },
    select: { tenantId: true },
  });

  const handledTenantIds = new Set(handledLogs.map((log) => log.tenantId));

  let processed = 0;
  let disabled = 0;
  let skipped = 0;

  for (const sub of expiredSubscriptions) {
    const { tenantId } = sub;

    // Idempotent: skip if we already logged this expiry event.
    if (handledTenantIds.has(tenantId)) {
      skipped++;
      continue;
    }

    // Disable all bots for this tenant.
    const { count } = await prisma.bot.updateMany({
      where: { tenantId, enabled: true },
      data: { enabled: false },
    });

    // Record the event.
    await prisma.activityLog.create({
      data: {
        tenantId,
        type: "trial_expired",
        title: "Trial expired — bots paused",
        description: `Free trial ended. ${count} bot(s) deactivated. Tenant must upgrade to reactivate.`,
        metadata: {
          botsDisabled: count,
          trialEndsAt: sub.trialEndsAt?.toISOString(),
        },
      },
    });

    disabled += count;
    processed++;
  }

  logger.info({ processed, disabled, skipped }, "[expired-trials] Completed");

  return NextResponse.json({ ok: true, processed, disabled, skipped });
}
