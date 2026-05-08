import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PATCH = withAuthAndTenant(
  async ({ id: userId, tenantId }, req, context, db) => {
    try {
      const { name, email } = await req.json();

      if (email && !emailRegex.test(email)) {
        return NextResponse.json({ error: "Invalid email" }, { status: 400 });
      }

      if (email) {
        const existing = await db.user.findFirst({
          where: {
            email,
            // User search is typically global for email uniqueness but scoped to tenant here if desired
            // However, users can be shared across tenants in some systems.
            // In THIS system, each user has a tenantId.
          }
        });
        if (existing && existing.id !== userId) {
          return NextResponse.json(
            { error: "Email already in use" },
            { status: 409 },
          );
        }
      }

      const updated = await db.user.update({
        where: { id: userId, tenantId },
        data: {
          name: name || undefined,
          email: email || undefined,
        },
        select: { id: true, name: true, email: true },
      });

      return NextResponse.json({ user: updated });
    } catch (error: unknown) {
      console.error("[Profile Update] Error:", error);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 },
      );
    }
  }
);
