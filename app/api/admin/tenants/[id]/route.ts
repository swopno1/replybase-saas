import { NextRequest, NextResponse } from "next/server";
import { logAdminActivity } from "@/lib/admin-audit";
import { withAdmin } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async (session, request, context, db) => {
  try {
    const { id: tenantId } = (await context.params) as { id: string };

    await logAdminActivity({
      adminId: session.user.id,
      action: "TENANT_READ",
      entityType: "TENANT",
      entityId: tenantId,
      description: `Admin read tenant details for tenant ID: ${tenantId}`,
      metadata: { tenantId },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isAdmin: true,
            createdAt: true,
          },
        },
        subscriptions: {
          include: {
            plan: true,
          },
        },
        bots: {
          include: {
            channels: true,
          },
        },
        _count: {
          select: {
            bots: true,
            flows: true,
            users: true,
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error("[Admin API] Error fetching tenant:", error);
    return NextResponse.json(
      { error: "Failed to fetch tenant" },
      { status: 500 },
    );
  }
});
