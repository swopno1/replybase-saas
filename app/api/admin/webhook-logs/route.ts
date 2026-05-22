import { NextRequest, NextResponse } from "next/server";
import { logAdminActivity } from "@/lib/admin-audit";
import { withAdmin } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (session, request, context, db) => {
  try {
    await logAdminActivity({
      adminId: session.user.id,
      action: "WEBHOOK_LOGS_READ",
      entityType: "WEBHOOK_LOG",
      description: "Admin viewed recent webhook logs",
      metadata: { limit: 50 },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    const logs = (await (db as any).webhookLog?.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
    })) || [];

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[Webhook Logs API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 },
    );
  }
});

export const DELETE = withAdmin(async (session, request, context, db) => {
  try {
    const result = await (db as any).webhookLog?.deleteMany({});
    console.log(`[Webhook Logs API] Deleted ${result?.count || 0} logs`);
    return NextResponse.json({ success: true, deleted: result?.count || 0 });
  } catch (error) {
    console.error("[Webhook Logs API] Error:", error);
    return NextResponse.json(
      { error: "Failed to clear logs" },
      { status: 500 },
    );
  }
});
