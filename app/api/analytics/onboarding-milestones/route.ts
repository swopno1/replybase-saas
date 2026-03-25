import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminActivationKpis } from "@/lib/admin-activation-kpis";

export const dynamic = 'force-dynamic';




const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "amirhossain.limon@gmail.com";

/**
 * GET /api/analytics/onboarding-milestones
 * Returns onboarding milestone statistics across all tenants
 * Requires admin access
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Check admin access
    if (
      !session?.user?.id ||
      (!session.user.isAdmin && session.user.email !== ADMIN_EMAIL)
    ) {
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
