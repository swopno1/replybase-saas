import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async (session, request, context, db) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalConversations, totalUsers, totalMessages, activeTenants] = await Promise.all([
      db.conversation.count({
        where: { createdAt: { gte: twentyFourHoursAgo } },
      }),
      db.user.count(),
      db.message.count({
        where: { createdAt: { gte: twentyFourHoursAgo } },
      }),
      db.tenant.count({
        where: {
          activityLogs: {
            some: { createdAt: { gte: twentyFourHoursAgo } },
          },
        },
      }),
    ]);

    const kpis = [
      {
        name: "Conversations (24h)",
        value: totalConversations,
        status: totalConversations > 0 ? "healthy" : "warning",
      },
      {
        name: "Total Users",
        value: totalUsers,
        status: totalUsers > 0 ? "healthy" : "critical",
      },
      {
        name: "Messages (24h)",
        value: totalMessages,
        status: totalMessages > 10 ? "healthy" : "warning",
      },
      {
        name: "Active Tenants (24h)",
        value: activeTenants,
        status: activeTenants > 0 ? "healthy" : "warning",
      },
    ];

    return NextResponse.json({ kpis });
  } catch (error) {
    console.error("[Admin API] Error fetching KPI health:", error);
    return NextResponse.json(
      { error: "Failed to fetch KPI health" },
      { status: 500 },
    );
  }
});
