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

    const leads = await prisma.lead.findMany({
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
    });

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("[Leads API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 },
    );
  }
});
