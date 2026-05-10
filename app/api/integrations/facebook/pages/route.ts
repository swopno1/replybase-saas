import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";

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
    const fbUrl = getFacebookGraphUrl("me/accounts", account.access_token, {
      fields: "id,name,access_token,category,tasks"
    });
    const fbRes = await fetch(fbUrl, {
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

      // Stale / revoked token patterns — auto-purge and tell the UI to re-auth
      const isStaleAuth =
        code === 190 ||
        /application has been deleted/i.test(message) ||
        /error validating application/i.test(message) ||
        /invalid oauth access token/i.test(message) ||
        /has not authorized application/i.test(message) ||
        /invalid appsecret_proof/i.test(message);

      if (isStaleAuth) {
        await prisma.account.deleteMany({
          where: { userId, provider: "facebook" },
        });
        return NextResponse.json({
          pages: [],
          connected: false,
          reason: "stale_token",
        });
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
        webhookSubscribed: true,
        flowAssignments: {
          where: { isActive: true },
          select: {
            flowId: true,
            flow: { select: { id: true, name: true, isActive: true } },
          },
        },
      },
    });

    // Create a map of connected page IDs → enrichment data
    const connectedMap = new Map(
      connectedPages.map((p) => [
        p.facebookId,
        {
          engineConnected: p.engineConnected,
          webhookSubscribed: p.webhookSubscribed,
          internalId: p.id,
          assignedFlow: p.flowAssignments?.flow
            ? {
                flowId: p.flowAssignments.flowId,
                id: p.flowAssignments.flow.id,
                name: p.flowAssignments.flow.name,
                isActive: p.flowAssignments.flow.isActive,
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
        webhookSubscribed: info?.webhookSubscribed || false,
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
