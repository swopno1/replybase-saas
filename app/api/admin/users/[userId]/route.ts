import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isPlatformAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "You cannot change your own admin status" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const { isAdmin } = body;

  if (typeof isAdmin !== "boolean") {
    return NextResponse.json(
      { error: "isAdmin must be a boolean" },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isAdmin },
    select: { id: true, name: true, email: true, isAdmin: true, tenantId: true },
  });

  // Audit Log
  await recordActivity({
    tenantId: updated.tenantId,
    userId: session.user.id,
    type: "settings_updated",
    title: "User Admin Status Updated by Admin",
    description: `Admin updated user ${updated.email} admin status to ${isAdmin}`,
    metadata: {
      targetUserId: updated.id,
      isAdmin,
    },
  });

  return NextResponse.json({ user: updated });
}
