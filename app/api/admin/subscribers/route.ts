import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isPlatformAdmin } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

    const where: any = {
      AND: [
        search ? {
          OR: [
            { tenant: { name: { contains: search, mode: "insensitive" } } },
            { tenant: { users: { some: { email: { contains: search, mode: "insensitive" } } } } },
            { tenant: { users: { some: { name: { contains: search, mode: "insensitive" } } } } },
          ],
        } : {},
        status && status !== "all" ? { status } : {},
      ],
    };

    const [subscribers, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
          tenant: {
            include: {
              users: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.subscription.count({ where }),
    ]);

    return NextResponse.json({ 
      subscribers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error: any) {
    console.error("[Admin API] Error fetching subscribers:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch subscribers",
        code: "FETCH_SUBSCRIBERS_ERROR",
        message: error.message 
      },
      { status: 500 },
    );
  }
}
