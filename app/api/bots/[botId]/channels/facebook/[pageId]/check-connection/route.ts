import { NextResponse } from "next/server";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const GET = withAuthAndTenant(async ({ tenantId }, _req, context, db) => {
  const { botId, pageId } = (await context.params) as { botId: string; pageId: string };

  try {
    const facebookPage = await db.facebookPage.findFirst({
      where: {
        facebookId: pageId,
        botId: botId,
        tenantId: tenantId,
      },
    });

    if (!facebookPage || !facebookPage.accessToken) {
      return NextResponse.json(
        { error: "Facebook page not found or not connected" },
        { status: 404 },
      );
    }

    const meUrl = getFacebookGraphUrl("me", facebookPage.accessToken, {
      fields: "id,name,permissions",
    });
    const meRes = await fetch(meUrl);
    const meData = await meRes.json();
    const tokenValid = meRes.ok;

    const subUrl = getFacebookGraphUrl(`${pageId}/subscribed_apps`, facebookPage.accessToken);
    const subRes = await fetch(subUrl);
    let webhookSubscribed = false;
    if (subRes.ok) {
      const subData = await subRes.json();
      webhookSubscribed = subData.data?.some((app: any) => app.id === process.env.FACEBOOK_CLIENT_ID);
    }

    if (webhookSubscribed !== facebookPage.webhookSubscribed) {
      await db.facebookPage.update({ where: { id: facebookPage.id }, data: { webhookSubscribed } });
    }

    return NextResponse.json({ success: true, tokenValid, webhookSubscribed, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: "Failed to perform diagnostics" }, { status: 500 });
  }
});
