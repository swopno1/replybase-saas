import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";
import { isChannelEnabled } from "@/lib/channel-config";
import { recordWebhookSetupLog } from "@/lib/webhook-setup-log";

export const dynamic = "force-dynamic";

/**
 * POST /api/bots/[botId]/channels/facebook/reconnect
 * Re-subscribes a Facebook page to webhooks if the token is still valid.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> },
) {
  if (!isChannelEnabled("facebook")) {
    return NextResponse.json({ error: "Facebook channel is not enabled" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { botId } = await params;
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { pageId } = body;

    if (!pageId) {
      return NextResponse.json({ error: "Missing pageId" }, { status: 400 });
    }

    const facebookPage = await prisma.facebookPage.findFirst({
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
    await prisma.facebookPage.update({
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
}
