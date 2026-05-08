import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";

export const dynamic = "force-dynamic";

export const GET = withAuthAndTenant(async ({ id: userId, tenantId }) => {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "facebook" },
  });

  if (!account || !account.access_token) {
    return NextResponse.json({ pages: [], connected: false });
  }

  try {
    const fbUrl = getFacebookGraphUrl("me/accounts", account.access_token);
    const fbRes = await fetch(fbUrl, {
      headers: { Authorization: `Bearer ${account.access_token}` },
    });

    if (!fbRes.ok) {
      return NextResponse.json({ error: "Failed to fetch from Facebook" }, { status: 502 });
    }

    const data = await fbRes.json();
    const pages = data.data || [];

    const connectedPages = await prisma.facebookPage.findMany({
      where: { tenantId },
      select: { facebookId: true, id: true, botId: true },
    });

    const connectedMap = new Map(connectedPages.map(p => [p.facebookId, p]));

    const enrichedPages = pages.map((page: any) => ({
      ...page,
      connected: connectedMap.has(page.id),
      internalId: connectedMap.get(page.id)?.id || null,
      botId: connectedMap.get(page.id)?.botId || null,
    }));

    return NextResponse.json({ pages: enrichedPages, connected: true });
  } catch (e) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
});
