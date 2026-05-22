import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async (session, request, context, db) => {
  try {
    const tenantsWithWebchat = await db.channel.count({
      where: { type: "web" },
    });

    const totalTenants = await db.tenant.count();

    const percentage = totalTenants > 0 ? (tenantsWithWebchat / totalTenants) * 100 : 0;

    return NextResponse.json({
      rollout: {
        total: tenantsWithWebchat,
        percentage: Math.round(percentage),
        target: 100,
      },
    });
  } catch (error) {
    console.error("[Admin API] Error fetching webchat rollout:", error);
    return NextResponse.json(
      { error: "Failed to fetch webchat rollout" },
      { status: 500 },
    );
  }
});
