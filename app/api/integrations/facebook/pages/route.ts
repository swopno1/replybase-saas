import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const GET = withAuthAndTenant(
  async ({ id: userId, tenantId }) => {
    // Get FB Account - this is user-specific, not tenant-specific
    const account = await prisma.account.findFirst({
      where: {
        userId: userId,
        provider: "facebook",
      },
    });

    if (!account || !account.access_token) {
      return NextResponse.json({ pages: [], connected: false });
    }

    // Call FB Graph API to get pages
    try {
      const fbRes = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?access_token=${account.access_token}`
      );
      if (!fbRes.ok) {
        const errorText = await fbRes.text();
        console.error("[Facebook Pages] Graph API Error:", errorText);
        return NextResponse.json(
          { error: "Failed to fetch pages from Facebook" },
          { status: 502 }
        );
      }

      const data = await fbRes.json();
      const pages = data.data || [];

      // Get connected pages from database, scoped by tenant
      const connectedPages = await prisma.facebookPage.findMany({
        where: { tenantId: tenantId },
        select: {
          facebookId: true,
          engineConnected: true,
        },
      });

      // Create a map of connected page IDs
      const connectedMap = new Map(
        connectedPages.map((p) => [p.facebookId, p.engineConnected])
      );

      // Enrich pages with connection status
      const enrichedPages = pages.map((page: { id: string }) => ({
        ...page,
        connected: connectedMap.has(page.id),
        engineConnected: connectedMap.get(page.id) || false,
      }));

      return NextResponse.json({
        pages: enrichedPages,
        connected: true,
      });
    } catch (e) {
      console.error("[Facebook Pages] Error:", e);
      return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
  }
);
