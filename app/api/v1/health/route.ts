import { NextResponse } from "next/server";
import { withApiKey } from "@/lib/route-helpers";

/**
 * Health check endpoint for authenticated API users.
 * Returns tenant information and verification status.
 */
export const GET = withApiKey(async (tenantId, request, ctx, db) => {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, createdAt: true }
  });

  return NextResponse.json({
    status: "authenticated",
    tenant: tenant?.name,
    timestamp: new Date().toISOString()
  });
});
