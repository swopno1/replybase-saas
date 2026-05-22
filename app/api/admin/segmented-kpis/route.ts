import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async (session, request, context, db) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [freeTenants, paidTenants, trialTenants] = await Promise.all([
      db.subscription.count({
        where: { status: "FREE" },
      }),
      db.subscription.count({
        where: { status: "ACTIVE" },
      }),
      db.subscription.count({
        where: { status: "TRIALING" },
      }),
    ]);

    const [leadsLast30Days, conversationsLast30Days] = await Promise.all([
      db.lead.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      db.conversation.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    return NextResponse.json({
      segments: [
        { label: "Free", value: freeTenants, color: "#94a3b8" },
        { label: "Paid", value: paidTenants, color: "#22c55e" },
        { label: "Trialing", value: trialTenants, color: "#3b82f6" },
      ],
      activity: {
        leads: leadsLast30Days,
        conversations: conversationsLast30Days,
      },
    });
  } catch (error) {
    console.error("[Admin API] Error fetching segmented KPIs:", error);
    return NextResponse.json(
      { error: "Failed to fetch segmented KPIs" },
      { status: 500 },
    );
  }
});
