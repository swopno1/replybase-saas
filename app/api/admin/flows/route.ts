import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// POST /api/admin/flows - Create a flow for a specific tenant (Admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN" && !session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { tenantId, name, description } = body;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Create flow
    const flow = await prisma.flow.create({
      data: {
        name: name || "New Admin-Created Flow",
        description: description || "Created by platform administrator",
        tenantId,
        isActive: false,
        nodes: {
          create: [
            {
              type: "message",
              content: { text: "Hello! How can I help you today?" },
              order: 0,
            },
          ],
        },
      },
    });

    return NextResponse.json({ flow });
  } catch (error) {
    console.error("[Admin Flows API] POST Error:", error);
    return NextResponse.json(
      { error: "Failed to create flow" },
      { status: 500 },
    );
  }
}
