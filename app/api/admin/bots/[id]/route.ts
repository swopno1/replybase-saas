import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// PATCH /api/admin/bots/:id - Update any bot (Admin only)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN" && !session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const { name, enabled } = body;

    const bot = await prisma.bot.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(enabled !== undefined && { enabled }),
      },
    });

    return NextResponse.json({ bot });
  } catch (error) {
    console.error("[Admin Bots API] PATCH Error:", error);
    return NextResponse.json(
      { error: "Failed to update bot" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/bots/:id - Delete any bot (Admin only)
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN" && !session.user.isAdmin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { id } = await context.params;

    await prisma.bot.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Bots API] DELETE Error:", error);
    return NextResponse.json(
      { error: "Failed to delete bot" },
      { status: 500 },
    );
  }
}
