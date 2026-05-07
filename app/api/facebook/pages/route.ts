import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isChannelEnabled } from "@/lib/channel-config";

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isChannelEnabled("facebook")) {
    return NextResponse.json({ error: "Facebook channel disabled" }, { status: 403 });
  }

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
      where: { tenantId: user.tenantId },
      include: {
        bot: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ pages });
  } catch (error) {
    console.error("[Facebook Pages API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch pages" }, { status: 500 });
  }
}
