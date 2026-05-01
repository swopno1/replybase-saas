import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getTenantPrisma } from "./prisma-tenant";

export function withAuthAndTenant(
  handler: (
    user: { id: string; tenantId: string },
    request: NextRequest,
    context: { params: Promise<Record<string, string | string[]>> },
    db: ReturnType<typeof getTenantPrisma>,
  ) => Promise<Response>,
) {
  return async (
    request: NextRequest,
    context: { params: Promise<Record<string, string | string[]>> },
  ) => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let user: { id: string; tenantId: string } | null = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          tenantId: true,
        },
      });
    } catch (error) {
      console.error("[Route Helper] Failed to resolve tenant context", error);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 },
      );
    }

    if (!user?.tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    const db = getTenantPrisma(user.tenantId);

    return await handler(
      { id: user.id, tenantId: user.tenantId },
      request,
      context,
      db
    );
  };
}
