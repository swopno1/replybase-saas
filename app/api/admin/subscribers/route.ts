import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isPlatformAdmin } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin-audit";

export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!isPlatformAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    await logAdminActivity({
      adminId: session.user.id,
      action: "SUBSCRIBERS_INDEX_READ",
      entityType: "SUBSCRIBER",
      description: `Admin listed subscribers with search: "${search}", status: "${status}", page: ${page}, limit: ${limit}`,
      metadata: { search, status, page, limit },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    const where: Prisma.TenantWhereInput = {
      AND: [
        search ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { users: { some: { email: { contains: search, mode: "insensitive" } } } },
            { users: { some: { name: { contains: search, mode: "insensitive" } } } },
          ],
        } : {},
        // Handle status filtering by looking at the active subscription
        status && status !== "all" ? {
          subscriptions: {
            status
          }
        } : {},
      ],
    };

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          users: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          subscriptions: {
            include: {
              plan: true
            }
          },
          _count: {
            select: {
              bots: true,
              flows: true
            }
          }
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.tenant.count({ where }),
    ]);

    // Map tenants back to a "subscriber" format for the frontend
    const subscribers = tenants.map(tenant => {
      const activeSub = tenant.subscriptions;
      return {
        id: activeSub?.id || `no-sub-${tenant.id}`,
        status: activeSub?.status || "inactive",
        currentPeriodEnd: activeSub?.currentPeriodEnd || null,
        stripeId: activeSub?.stripeId || null,
        plan: activeSub?.plan || { name: "No Plan", price: 0 },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          users: tenant.users
        },
        _count: tenant._count
      };
    });

    return NextResponse.json({ 
      subscribers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error: unknown) {
    console.error("[Admin API] Error fetching subscribers:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch subscribers",
        code: "FETCH_SUBSCRIBERS_ERROR",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 },
    );
  }
}
