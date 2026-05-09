import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// PATCH /api/admin/channels/:id - Update channel settings and flow assignment
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
    const { flowId, isActive } = body;

    const channel = await prisma.channel.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(flowId !== undefined && {
          flowAssignments: {
            upsert: {
              create: {
                flowId: flowId,
                isActive: true,
              },
              update: {
                flowId: flowId,
                isActive: true,
              },
            },
          },
        }),
      },
    });

    return NextResponse.json({ channel });
  } catch (error) {
    console.error("[Admin Channel API] PATCH Error:", error);
    return NextResponse.json(
      { error: "Failed to update channel" },
      { status: 500 },
    );
  }
}
