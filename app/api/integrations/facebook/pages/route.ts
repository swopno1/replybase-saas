import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const GET = withAuthAndTenant(async ({ id: userId, tenantId }) => {
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
    const fbRes = await fetch("https://graph.facebook.com/v18.0/me/accounts", {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
      },
    });
    if (!fbRes.ok) {
      const errorText = await fbRes.text();
      console.error("[Facebook Pages] Graph API Error:", errorText);

      let message = "Failed to fetch pages from Facebook";
      let code: number | undefined;
      try {
        const parsed = JSON.parse(errorText) as {
          error?: { message?: string; code?: number };
        };
        if (parsed.error?.message) {
          message = parsed.error.message;
        }
        if (typeof parsed.error?.code === "number") {
          code = parsed.error.code;
        }
      } catch {
        // Keep default message when upstream payload is not JSON.
      }

      const status = code === 190 ? 401 : 502;
      return NextResponse.json(
        {
          error: message,
          code,
        },
        { status },
      );
    }

    const data = await fbRes.json();
    const pages = data.data || [];

    // Get connected pages from database, scoped by tenant
    const connectedPages = await prisma.facebookPage.findMany({
      where: { tenantId: tenantId },
      select: {
        id: true,
        facebookId: true,
        engineConnected: true,
        flowAssignments: {
          where: { isActive: true },
          select: {
            flowId: true,
            flow: { select: { id: true, name: true, isActive: true } },
          },
          take: 1,
        },
      },
    });

    // Create a map of connected page IDs → enrichment data
    const connectedMap = new Map(
      connectedPages.map((p) => [
        p.facebookId,
        {
          engineConnected: p.engineConnected,
          internalId: p.id,
          assignedFlow: p.flowAssignments[0]?.flow
            ? {
                flowId: p.flowAssignments[0].flowId,
                id: p.flowAssignments[0].flow.id,
                name: p.flowAssignments[0].flow.name,
                isActive: p.flowAssignments[0].flow.isActive,
              }
            : null,
        },
      ]),
    );

    // Enrich pages with connection status, internalId and assigned flow
    const enrichedPages = pages.map((page: { id: string }) => {
      const info = connectedMap.get(page.id);
      return {
        ...page,
        connected: connectedMap.has(page.id),
        engineConnected: info?.engineConnected || false,
        internalId: info?.internalId || null,
        assignedFlow: info?.assignedFlow || null,
      };
    });

    return NextResponse.json({
      pages: enrichedPages,
      connected: true,
    });
  } catch (e) {
    console.error("[Facebook Pages] Error:", e);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
});
