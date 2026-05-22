import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getTenantPrisma } from "./prisma-tenant";
import { isPlatformAdmin } from "./admin";
import { prisma } from "./prisma";
import type { Session } from "next-auth";

export function withAuthAndTenant(
  handler: (
    user: { id: string; tenantId: string; role: string; isAdmin: boolean; email?: string | null; name?: string | null },
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
      {
        id: session.user.id,
        tenantId: session.user.tenantId,
        role: (session.user as any).role,
        isAdmin: (session.user as any).isAdmin,
        email: session.user.email,
        name: session.user.name
      },
      request,
      context,
      db
    );
  };
}

export function withAdmin(
  handler: (
    session: Session,
    request: NextRequest,
    context: { params: Promise<Record<string, string | string[]>> },
    db: typeof prisma,
  ) => Promise<Response>,
) {
  return async (
    request: NextRequest,
    context: { params: Promise<Record<string, string | string[]>> },
  ) => {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isPlatformAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return await handler(
      session,
      request,
      context,
      prisma
    );
  };
}
