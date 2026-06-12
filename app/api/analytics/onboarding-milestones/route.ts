import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/route-helpers";
import { getAdminActivationKpis } from "@/lib/admin-activation-kpis";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async (_session, _request, _context, _db) => {
  try {
    const analytics = await getAdminActivationKpis();
    return NextResponse.json(analytics);
  } catch (error) {
    console.error("[Analytics] Error fetching onboarding statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
});
