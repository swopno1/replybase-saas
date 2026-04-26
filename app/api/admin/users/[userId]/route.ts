import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isPlatformAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { logAdminActivity } from "@/lib/admin-audit";

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
  const { role } = body;
 
  const validRoles = ["USER", "ADMIN", "SUPERADMIN"];
  if (role && !validRoles.includes(role)) {
    return NextResponse.json(
      { 
        error: "Invalid role provided", 
        code: "INVALID_ROLE",
        context: { role, validRoles }
      },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { 
      role: role || undefined,
      // Keep isAdmin in sync for backward compatibility if needed, 
      // but primary logic should now use role.
      isAdmin: role ? (role === "ADMIN" || role === "SUPERADMIN") : undefined 
    },
    select: { id: true, name: true, email: true, isAdmin: true, role: true, tenantId: true },
  });
 
  // Audit Log
  await logAdminActivity({
    adminId: session.user.id,
    action: role === "USER" ? "USER_DEMOTED" : "USER_PROMOTED",
    entityType: "USER",
    entityId: updated.id,
    description: `Admin updated user ${updated.email} role to ${updated.role}`,
    metadata: {
      targetUserId: updated.id,
      oldRole: target.role,
      newRole: updated.role,
    },
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  });

  return NextResponse.json({ user: updated });
}
