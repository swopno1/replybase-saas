import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthAndTenant } from "@/lib/route-helpers";

// GET: List tenant's users
export async function GET() {
  return withAuthAndTenant(async ({ tenantId }) => {
    try {
      const users = await prisma.user.findMany({
        where: {
          tenantId: tenantId,
        },
        select: {
          id: true,
          name: true,
          image: true,
        },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ users });
    } catch (error) {
      console.error("[Users API] Error fetching users:", error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }
  });
}
