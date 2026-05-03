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
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getTenantPrisma(session.user.tenantId);

    return await handler(
      { id: session.user.id, tenantId: session.user.tenantId },
      request,
      context,
      db
    );
  };
}
