import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const GET: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");

    const [leads, subscription] = await Promise.all([
      prisma.lead.findMany({
        where: {
          tenantId,
          ...(status && { status }),
        },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.subscription.findFirst({
        where: { tenantId, status: { in: ["active", "trialing"] } },
        include: { plan: { select: { price: true } } },
      }),
    ]);

    // CSV export is available for trial users and paid subscribers (plan.price > 0).
    const canExport =
      subscription?.status === "trialing" ||
      (subscription?.status === "active" &&
        (subscription.plan.price ?? 0) > 0);

    return NextResponse.json({ leads, canExport: canExport ?? false });
  } catch (error) {
    console.error("[Leads API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 },
    );
  }
});
