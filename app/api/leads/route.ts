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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const [leads, totalCount, subscription] = await Promise.all([
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
        skip,
        take: limit,
      }),
      prisma.lead.count({
        where: {
          tenantId,
          ...(status && { status }),
        },
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

    return NextResponse.json({
      leads,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      canExport: canExport ?? false,
    });
  } catch (error) {
    console.error("[Leads API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 },
    );
  }
});

export const DELETE: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request) => {
  try {
    const { ids } = await request.json();

    if (!ids || (!Array.isArray(ids) && ids !== "ALL") || (Array.isArray(ids) && ids.length === 0)) {
      return NextResponse.json(
        { error: "Invalid input: ids must be a non-empty array or 'ALL'" },
        { status: 400 },
      );
    }

    const where = ids === "ALL" ? { tenantId } : { id: { in: ids }, tenantId };

    const { count } = await prisma.lead.deleteMany({
      where,
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("[Leads API] Batch delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete leads" },
      { status: 500 },
    );
  }
});

export const PATCH: (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> = withAuthAndTenant(async ({ tenantId }, request) => {
  try {
    const { ids, status } = await request.json();

    if (!ids || (!Array.isArray(ids) && ids !== "ALL") || (Array.isArray(ids) && ids.length === 0) || !status) {
      return NextResponse.json(
        { error: "Invalid input: ids and status are required" },
        { status: 400 },
      );
    }

    const where = ids === "ALL" ? { tenantId } : { id: { in: ids }, tenantId };

    const { count } = await prisma.lead.updateMany({
      where,
      data: { status },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("[Leads API] Batch update error:", error);
    return NextResponse.json(
      { error: "Failed to update leads" },
      { status: 500 },
    );
  }
});
