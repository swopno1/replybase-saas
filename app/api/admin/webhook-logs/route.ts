import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin-audit";

export const dynamic = 'force-dynamic';

type WebhookLogDelegate = {
  findMany?: (args: {
    take: number;
    orderBy: { createdAt: "desc" };
  }) => Promise<unknown[]>;
  deleteMany?: (args: Record<string, never>) => Promise<{ count?: number }>;
};

const prismaWithWebhookLogs = prisma as typeof prisma & {
  webhookLog?: WebhookLogDelegate;
};

// GET: Fetch recent webhook logs
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { isPlatformAdmin } = await import("@/lib/admin");
    
    if (!isPlatformAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await logAdminActivity({
      adminId: session.user.id,
      action: "WEBHOOK_LOGS_READ",
      entityType: "WEBHOOK_LOG",
      description: "Admin viewed recent webhook logs",
      metadata: { limit: 50 },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    // Get last 50 webhook logs, ordered by most recent

    const logs =
      (await prismaWithWebhookLogs.webhookLog?.findMany({
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
}

// DELETE: Clear webhook logs
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const { isPlatformAdmin } = await import("@/lib/admin");

    if (!isPlatformAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete ALL webhook logs
    const result = await prismaWithWebhookLogs.webhookLog?.deleteMany({});

    console.log(`[Webhook Logs API] Deleted ${result?.count || 0} logs`);

    return NextResponse.json({ success: true, deleted: result?.count || 0 });
  } catch (error) {
    console.error("[Webhook Logs API] Error:", error);
    return NextResponse.json(
      { error: "Failed to clear logs" },
      { status: 500 },
    );
  }
}
