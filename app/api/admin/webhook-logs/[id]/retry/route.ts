import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin-audit";

export const dynamic = "force-dynamic";

// POST /api/admin/webhook-logs/[id]/retry
// Re-dispatches the original webhook event for a given log entry.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const { isPlatformAdmin } = await import("@/lib/admin");

    if (!isPlatformAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Webhook log ID is required" },
        { status: 400 },
      );
    }

    // Fetch the original webhook log entry
    const log = await (prisma as any).webhookLog.findUnique({
      where: { id },
    });

    if (!log) {
      return NextResponse.json(
        { error: "Webhook log not found" },
        { status: 404 },
      );
    }

    if (!log.tenantId) {
      return NextResponse.json(
        {
          error:
            "Cannot replay: webhook log is not associated with a specific tenant",
        },
        { status: 422 },
      );
    }

    if (!log.event) {
      return NextResponse.json(
        {
          error:
            "Cannot replay: webhook log does not have an event type recorded",
        },
        { status: 422 },
      );
    }

    // Re-dispatch the webhook using the stored event type and payload data
    const { dispatchWebhook } = await import(
      "@/lib/services/webhook-dispatcher"
    );

    await dispatchWebhook(log.tenantId, log.event, log.data);

    // Audit the replay action
    await logAdminActivity({
      adminId: session.user.id,
      action: "WEBHOOK_LOG_REPLAYED",
      entityType: "WEBHOOK_LOG",
      entityId: id,
      description: `Admin replayed webhook log entry (event: ${log.event}, tenant: ${log.tenantId})`,
      metadata: {
        logId: id,
        event: log.event,
        tenantId: log.tenantId,
        source: log.source,
        originalCreatedAt: log.createdAt,
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      success: true,
      message: `Webhook event '${log.event}' has been re-dispatched for tenant ${log.tenantId}`,
      logId: id,
      event: log.event,
    });
  } catch (error) {
    console.error("[Webhook Log Retry API] Error:", error);
    return NextResponse.json(
      { error: "Failed to replay webhook" },
      { status: 500 },
    );
  }
}
