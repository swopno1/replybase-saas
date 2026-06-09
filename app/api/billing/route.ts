import { NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { BillingService } from "@/lib/billing-service";
import logger from "@/lib/logger";

export const dynamic = 'force-dynamic';

export const GET = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const billingService = new BillingService(db as never);
    const data = await billingService.getBillingData(tenantId);
    return NextResponse.json(data);
  } catch (error) {
    logger.error({ error }, "[Billing API] Failed to fetch billing data");
    return NextResponse.json(
      { error: "Failed to fetch billing data" },
      { status: 500 },
    );
  }
});
