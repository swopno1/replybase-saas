import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTenantLeadNotificationTest } from "@/lib/lead-notifications";

export const dynamic = 'force-dynamic';




export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const results = await sendTenantLeadNotificationTest(user.tenantId);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("[Tenant Lead Notifications Test API] POST failed:", error);
    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 500 },
    );
  }
}
