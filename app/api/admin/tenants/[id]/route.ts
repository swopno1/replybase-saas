import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isPlatformAdmin } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!isPlatformAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: tenantId } = await params;

    const tenant = await prisma.tenant.findUnique({
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
}
