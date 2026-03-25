import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
