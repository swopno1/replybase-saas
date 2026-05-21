import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isPlatformAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { logAdminActivity } from "@/lib/admin-audit";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session)) {
    return null;
  }
  return session;
}

import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const role = searchParams.get("role") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  await logAdminActivity({
    adminId: session.user.id,
    action: "USERS_INDEX_READ",
    entityType: "USER",
    description: `Admin listed users with search: "${search}", role: "${role}", page: ${page}, limit: ${limit}`,
    metadata: { search, role, page, limit },
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  });

  const where: Prisma.UserWhereInput = {
    AND: [
      search ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      } : {},
      role ? { role: role as Prisma.EnumUserRoleFilter } : {},
    ],
  };

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          isAdmin: true,
          role: true,
          createdAt: true,
          tenant: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ 
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error: unknown) {
    console.error("Admin Users GET error:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch users",
        code: "FETCH_USERS_ERROR",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
