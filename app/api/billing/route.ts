import { NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { BillingService } from "@/lib/services/billing-service";

export const dynamic = 'force-dynamic';

export const GET = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const billingService = new BillingService(db as never);
    const data = await billingService.getBillingData(tenantId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Billing API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing data" },
      { status: 500 },
    );
  }
});
