import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/facebook/pages - Get connected Facebook pages
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const pages = await prisma.facebookPage.findMany({
      where: {
        tenantId: user.tenantId,
      },
      select: {
        id: true,
        name: true,
        facebookId: true,
        engineConnected: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ pages });
  } catch (error) {
    console.error("[Facebook Pages API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pages" },
      { status: 500 },
    );
  }
}
