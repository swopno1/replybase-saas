import { NextResponse } from "next/server";
import { sendTenantLeadNotificationTest } from "@/lib/lead-notifications";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const POST = withAuthAndTenant(async (user, _request, _context, _db) => {
  try {
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
});
