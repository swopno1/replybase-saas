import { NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { isChannelEnabled } from "@/lib/channel-config";

export const dynamic = 'force-dynamic';

export const GET = withAuthAndTenant(async (user, req, ctx, db) => {
  if (!isChannelEnabled("facebook")) return NextResponse.json({ error: "Facebook disabled" }, { status: 403 });

  try {
    const pages = await db.facebookPage.findMany({
      where: { tenantId: user.tenantId },
      include: { bot: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ pages });
  } catch (error) {
    console.error("[Facebook Pages API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch pages" }, { status: 500 });
  }
});
