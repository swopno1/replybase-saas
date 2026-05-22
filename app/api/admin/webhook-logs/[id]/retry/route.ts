import { NextRequest, NextResponse } from "next/server";
import { logAdminActivity } from "@/lib/admin-audit";
import { withAdmin } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (session, request, context, db) => {
  try {
    const { id } = (await context.params) as { id: string };

    if (!id) {
      return NextResponse.json(
        { error: "Webhook log ID is required" },
        { status: 400 },
      );
    }

    // Fetch the original webhook log entry
    const log = await (db as any).webhookLog.findUnique({
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
});
