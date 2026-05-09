import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { invalidateTenantCache } from "@/lib/subscription";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 400 });
    }

    // Invalidate the limits cache for this tenant
    await invalidateTenantCache(tenantId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Billing Refresh] Error:", error);
    return NextResponse.json(
      { error: "Failed to refresh billing cache" },
      { status: 500 }
    );
  }
}
