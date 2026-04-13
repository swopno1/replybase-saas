/**
 * Cron job: Prune old log records from the database.
 *
 * Retention policy (configurable via env):
 *   PRUNE_WEBHOOK_LOG_DAYS    — WebhookLog rows older than N days  (default: 30)
 *   PRUNE_EXECUTION_LOG_DAYS  — ExecutionLog rows older than N days (default: 30)
 *   PRUNE_ACTIVITY_LOG_DAYS   — ActivityLog rows older than N days  (default: 90)
 *   PRUNE_WEBCHAT_EVENT_DAYS  — WebChatEvent rows older than N days (default: 30)
 *
 * Run weekly (e.g. Sunday 02:00 UTC) — daily is also safe.
 * Security: requires Authorization: Bearer <CRON_SECRET>.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function getRetentionDays(envKey: string, defaultDays: number): number {
  const val = process.env[envKey];
  if (!val) return defaultDays;
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultDays;
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runPruneLogs();
}

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runPruneLogs();
}

async function runPruneLogs(): Promise<NextResponse> {
  const webhookCutoff = daysAgo(getRetentionDays("PRUNE_WEBHOOK_LOG_DAYS", 30));
  const executionCutoff = daysAgo(
    getRetentionDays("PRUNE_EXECUTION_LOG_DAYS", 30),
  );
  const activityCutoff = daysAgo(
    getRetentionDays("PRUNE_ACTIVITY_LOG_DAYS", 90),
  );
  const webchatEventCutoff = daysAgo(
    getRetentionDays("PRUNE_WEBCHAT_EVENT_DAYS", 30),
  );

  const [webhook, execution, activity, webchatEvent] = await Promise.all([
    prisma.webhookLog.deleteMany({
      where: { createdAt: { lt: webhookCutoff } },
    }),
    prisma.executionLog.deleteMany({
      where: { createdAt: { lt: executionCutoff } },
    }),
    // Keep trial_reminder_sent and trial_expired entries (they serve as dedup guards).
    prisma.activityLog.deleteMany({
      where: {
        createdAt: { lt: activityCutoff },
        type: {
          notIn: ["trial_reminder_sent", "trial_expired", "signup_intent"],
        },
      },
    }),
    prisma.webChatEvent.deleteMany({
      where: { createdAt: { lt: webchatEventCutoff } },
    }),
  ]);

  const summary = {
    webhookLogs: webhook.count,
    executionLogs: execution.count,
    activityLogs: activity.count,
    webchatEvents: webchatEvent.count,
  };

  console.log("[prune-logs]", JSON.stringify(summary));

  return NextResponse.json({ ok: true, deleted: summary });
}
