import { NextRequest, NextResponse } from "next/server";
import { logAdminActivity } from "@/lib/admin-audit";
import { withAdmin } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const PATCH = withAdmin(async (session, request, context, db) => {
  const { userId } = (await context.params) as { userId: string };

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

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { 
      role: role || undefined,
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
});
