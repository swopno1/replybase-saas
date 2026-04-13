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

  let processed = 0;
  let disabled = 0;
  let skipped = 0;

  for (const sub of expiredSubscriptions) {
    const { tenantId } = sub;

    // Idempotent: skip if we already logged this expiry event.
    const alreadyHandled = await prisma.activityLog.findFirst({
      where: { tenantId, type: "trial_expired" },
      select: { id: true },
    });

    if (alreadyHandled) {
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

  console.log(
    `[expired-trials] processed=${processed} disabled=${disabled} skipped=${skipped}`,
  );

  return NextResponse.json({ ok: true, processed, disabled, skipped });
}
