import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isPlatformAdmin } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import { getAdminActivationKpis } from "@/lib/admin-activation-kpis";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/onboarding-milestones
 * Returns onboarding milestone statistics across all tenants
 * Requires admin access
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!isPlatformAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const analytics = await getAdminActivationKpis();

    return NextResponse.json(analytics);
  } catch (error) {
    console.error("[Analytics] Error fetching onboarding statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
