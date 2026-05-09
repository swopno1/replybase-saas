import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// POST /api/admin/bots - Create a bot for a specific tenant (Admin only)
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
    const { tenantId, name } = body;

    if (!tenantId || !name) {
      return NextResponse.json({ error: "Tenant ID and name are required" }, { status: 400 });
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Create bot
    const bot = await prisma.bot.create({
      data: {
        name,
        tenantId,
        enabled: true,
        channels: {
          create: {
            tenantId,
            type: "web",
            name: "Webchat Channel",
            enabled: true,
            isActive: true,
          },
        },
      },
    });

    return NextResponse.json({ bot });
  } catch (error) {
    console.error("[Admin Bots API] POST Error:", error);
    return NextResponse.json(
      { error: "Failed to create bot" },
      { status: 500 },
    );
  }
}
