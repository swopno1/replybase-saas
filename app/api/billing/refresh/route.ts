import { NextResponse } from "next/server";
import { invalidateTenantCache } from "@/lib/subscription";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const POST = withAuthAndTenant(async ({ tenantId }) => {
  try {
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
});
