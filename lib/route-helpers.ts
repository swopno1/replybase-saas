import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getTenantPrisma } from "./prisma-tenant";
import { isPlatformAdmin } from "./admin";
import { prisma } from "./prisma";
import type { Session } from "next-auth";
import * as Sentry from "@sentry/nextjs";
import { hashApiKey } from "./api-keys";
import { getTenantLimits } from "./subscription";
import { getPlanConfig } from "./plans";

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

    Sentry.setUser({ id: session.user.id });
    Sentry.setTag("tenant_id", session.user.tenantId);
    Sentry.setTag("user_role", (session.user as any).role || "USER");

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

    if (session.user) {
      Sentry.setUser({ id: session.user.id });
      if (session.user.tenantId) {
        Sentry.setTag("tenant_id", session.user.tenantId);
      }
      Sentry.setTag("user_role", (session.user as any).role || "ADMIN");
    }

    return await handler(
      session,
      request,
      context,
      prisma
    );
  };
}

/**
 * Higher-order function for Public API routes using API Key authentication.
 */
export function withApiKey(
  handler: (
    tenantId: string,
    request: NextRequest,
    context: { params: Promise<Record<string, string | string[]>> },
    db: ReturnType<typeof getTenantPrisma>,
  ) => Promise<Response>,
) {
  return async (
    request: NextRequest,
    context: { params: Promise<Record<string, string | string[]>> },
  ) => {
    const apiKey = request.headers.get("X-API-Key");

    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key required. Provide it in the X-API-Key header." },
        { status: 401 }
      );
    }

    const keyHash = hashApiKey(apiKey);

    const keyRecord = await prisma.apiKey.findUnique({
      where: { keyHash, isActive: true },
      select: { tenantId: true, id: true },
    });

    if (!keyRecord) {
      return NextResponse.json(
        { error: "Invalid or inactive API Key." },
        { status: 401 }
      );
    }

    // Check if the tenant's plan allows API access
    const limits = await getTenantLimits(keyRecord.tenantId);
    const planConfig = getPlanConfig(limits.name);

    if (!(planConfig as any).apiAccess) {
      return NextResponse.json(
        {
          error: "API access is not available on your current plan.",
          message: `The ${planConfig.displayName} plan does not include API access. Please upgrade to Scale or Business.`
        },
        { status: 403 }
      );
    }

    // Update lastUsed in the background
    prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsed: new Date() },
    }).catch(err => console.error("Failed to update API key lastUsed:", err));

    Sentry.setTag("tenant_id", keyRecord.tenantId);
    Sentry.setTag("auth_method", "api_key");

    const db = getTenantPrisma(keyRecord.tenantId);

    return await handler(
      keyRecord.tenantId,
      request,
      context,
      db
    );
  };
}
