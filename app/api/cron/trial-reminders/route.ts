/**
 * Cron job: Send trial expiry reminder emails.
 *
 * Trigger intervals: 10 days, 5 days, 2 days before trial end.
 * Deduplication: writes ActivityLog type "trial_reminder_sent" with
 *   metadata.daysRemaining so each interval is sent at most once per tenant.
 *
 * Security: requires Authorization: Bearer <CRON_SECRET> header.
 *
 * Invoke via Vercel Cron, GitHub Actions, or any HTTP scheduler — daily is fine.
 * Example Vercel vercel.json cron:
 *   { "path": "/api/cron/trial-reminders", "schedule": "0 8 * * *" }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTrialReminderEmail } from "@/lib/trial-reminder-email";
import { isCronAuthorized } from "@/lib/cron-auth";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

// Only notify at these threshold days remaining.
const REMINDER_THRESHOLDS = [10, 5, 2] as const;

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runReminders();
}

// Also allow GET so Vercel Cron (which uses GET) works out-of-the-box.
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runReminders();
}

async function runReminders(): Promise<NextResponse> {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://app.replybase.co.uk";
  const now = new Date();

  // Find subscriptions that:
  //  - are on the free plan (still in trial)
  //  - have a trialEndsAt within the next 10 days
  //  - have NOT yet expired (trialEndsAt > now)
  const freePlan = await prisma.plan.findUnique({ where: { name: "free" } });
  if (!freePlan) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      note: "No free plan found",
    });
  }

  const tenDaysFromNow = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

  const subscriptionsInWindow = await prisma.subscription.findMany({
    where: {
      planId: freePlan.id,
      trialEndsAt: {
        gt: now,
        lte: tenDaysFromNow,
      },
    },
    select: {
      tenantId: true,
      trialEndsAt: true,
      tenant: {
        select: {
          id: true,
          users: {
            select: {
              email: true,
              name: true,
            },
            where: {
              email: { not: null },
            },
            take: 1,
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  const results: Array<{
    tenantId: string;
    daysRemaining: number;
    sent: boolean;
    skipped: boolean;
    error?: string;
  }> = [];

  for (const sub of subscriptionsInWindow) {
    const { tenantId, trialEndsAt, tenant } = sub;

    if (!trialEndsAt) continue;

    const daysRemaining = Math.ceil(
      (trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Find which threshold this falls into.
    const threshold = REMINDER_THRESHOLDS.find(
      (t) =>
        daysRemaining <= t && daysRemaining > (t === 10 ? 5 : t === 5 ? 2 : 0),
    );

    // Also trigger the 2-day reminder on days 1 and 2.
    const effectiveThreshold =
      threshold ?? (daysRemaining > 0 && daysRemaining <= 2 ? 2 : null);

    if (!effectiveThreshold) continue;

    // Deduplicate: check if we already sent a reminder for this threshold.
    const alreadySent = await prisma.activityLog.findFirst({
      where: {
        tenantId,
        type: "trial_reminder_sent",
        metadata: {
          path: ["daysThreshold"],
          equals: effectiveThreshold,
        },
      },
      select: { id: true },
    });

    if (alreadySent) {
      results.push({ tenantId, daysRemaining, sent: false, skipped: true });
      continue;
    }

    const user = tenant.users[0];
    if (!user?.email) {
      results.push({
        tenantId,
        daysRemaining,
        sent: false,
        skipped: true,
        error: "No user email found",
      });
      continue;
    }

    // Look up tenant's signup intent for recommended plan.
    const intentLog = await prisma.activityLog.findFirst({
      where: { tenantId, type: "signup_intent" },
      orderBy: { createdAt: "desc" },
      select: { metadata: true },
    });

    const intentMeta =
      intentLog?.metadata &&
      typeof intentLog.metadata === "object" &&
      !Array.isArray(intentLog.metadata)
        ? (intentLog.metadata as Record<string, unknown>)
        : null;

    const rawPlan = intentMeta?.plan;
    const recommendedPlan =
      typeof rawPlan === "string" &&
      ["launch", "grow", "scale", "business"].includes(rawPlan)
        ? rawPlan
        : "scale";

    const sendResult = await sendTrialReminderEmail({
      to: user.email,
      userName: user.name || user.email,
      daysRemaining,
      recommendedPlan,
      appUrl,
    });

    if (sendResult.ok) {
      // Record success so we don't resend this threshold.
      await prisma.activityLog.create({
        data: {
          tenantId,
          type: "trial_reminder_sent",
          title: "Trial reminder email sent",
          description: `Sent trial expiry reminder with ${effectiveThreshold}-day threshold to ${user.email}`,
          metadata: {
            daysThreshold: effectiveThreshold,
            daysRemaining,
            sentTo: user.email,
            recommendedPlan,
          },
        },
      });
      results.push({ tenantId, daysRemaining, sent: true, skipped: false });
    } else {
      results.push({
        tenantId,
        daysRemaining,
        sent: false,
        skipped: false,
        error: sendResult.error,
      });
    }
  }

  const sent = results.filter((r) => r.sent).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.sent && !r.skipped).length;

  logger.info({ processed: results.length, sent, skipped, failed }, "[trial-reminders] Completed");

  return NextResponse.json({
    ok: true,
    processed: results.length,
    sent,
    skipped,
    failed,
  });
}
