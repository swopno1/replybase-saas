import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Fetch recent webhook logs
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get last 50 webhook logs, ordered by most recent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logs =
      (await (prisma as any).webhookLog?.findMany({
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

    // Delete all logs older than 1 hour
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).webhookLog?.deleteMany({
      where: {
        createdAt: {
          lt: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Webhook Logs API] Error:", error);
    return NextResponse.json(
      { error: "Failed to clear logs" },
      { status: 500 },
    );
  }
}
