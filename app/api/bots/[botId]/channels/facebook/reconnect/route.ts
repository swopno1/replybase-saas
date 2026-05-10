import { NextResponse } from "next/server";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";
import { isChannelEnabled } from "@/lib/channel-config";
import { recordWebhookSetupLog } from "@/lib/webhook-setup-log";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const POST = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  if (!isChannelEnabled("facebook")) {
    return NextResponse.json({ error: "Facebook channel is not enabled" }, { status: 403 });
  }

  const { botId } = (await context.params) as { botId: string };

  try {
    const body = await req.json();
    const { pageId } = body;

    if (!pageId) {
      return NextResponse.json({ error: "Missing pageId" }, { status: 400 });
    }

    const facebookPage = await db.facebookPage.findFirst({
      where: {
        facebookId: pageId,
        botId: botId,
        tenantId: tenantId,
      },
    });

    if (!facebookPage || !facebookPage.accessToken) {
      return NextResponse.json({ error: "Page not found or not connected" }, { status: 404 });
    }

    // 1. Verify token is still valid
    const meUrl = getFacebookGraphUrl("me", facebookPage.accessToken, {
      fields: "id,name",
    });
    const meRes = await fetch(meUrl);
    if (!meRes.ok) {
      // Token is likely expired or revoked
      return NextResponse.json({ 
        error: "Facebook token expired or revoked. Please re-authenticate.", 
        reauthRequired: true 
      }, { status: 401 });
    }

    // 2. Re-subscribe to webhooks
    const subUrl = getFacebookGraphUrl(
      `${pageId}/subscribed_apps`,
      facebookPage.accessToken,
      {
        subscribed_fields: "messages,messaging_postbacks,messaging_optins,messaging_referrals",
      },
    );
    
    const subRes = await fetch(subUrl, { method: "POST" });
    const subData = await subRes.json();

    if (!subRes.ok || !subData.success) {
       return NextResponse.json({ 
         error: "Failed to re-subscribe webhooks. Facebook API error.",
         details: subData.error?.message 
       }, { status: 500 });
    }

    // 3. Update database status
    await db.facebookPage.update({
      where: { id: facebookPage.id },
      data: { webhookSubscribed: true },
    });

    // 4. Log the event
    await recordWebhookSetupLog({
      source: "facebook",
      event: "page_reconnect",
      outcome: "setup_success",
      tenantId: tenantId,
      channelId: pageId,
      metadata: { pageName: facebookPage.name, botId },
    });

    return NextResponse.json({ 
      success: true,
      message: "Facebook page successfully reconnected and webhooks restored." 
    });
  } catch (error) {
    console.error("[Facebook Reconnect] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
