import { NextResponse } from "next/server";
import { recordWebhookSetupLog } from "@/lib/webhook-setup-log";
import { isChannelEnabled } from "@/lib/channel-config";
import { getFacebookGraphUrl, setupMessengerProfile } from "@/lib/server/facebook-utils";
import { checkChannelLimit } from "@/lib/subscription";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

// GET /api/bots/[botId]/channels/facebook - Get connected Facebook pages for this bot
export const GET = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  if (!isChannelEnabled("facebook")) {
    return NextResponse.json({ error: "Facebook channel is not enabled" }, { status: 403 });
  }

  const { botId } = (await context.params) as { botId: string };

  const [pages, limitStatus] = await Promise.all([
    db.facebookPage.findMany({
      where: {
        tenantId: tenantId,
      },
      select: {
        id: true,
        name: true,
        facebookId: true,
        engineConnected: true,
        botId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    checkChannelLimit(tenantId, botId),
  ]);

  return NextResponse.json({ pages, limitStatus });
});

// POST /api/bots/[botId]/channels/facebook - Connect a page to this specific bot
export const POST = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  if (!isChannelEnabled("facebook")) {
    return NextResponse.json({ error: "Facebook channel is not enabled" }, { status: 403 });
  }

  const { botId } = (await context.params) as { botId: string };

  // Verify bot belongs to tenant
  const bot = await db.bot.findFirst({
    where: { id: botId, tenantId },
  });
  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  const limitStatus = await checkChannelLimit(tenantId, botId);
  if (!limitStatus.allowed) {
    return NextResponse.json(
      {
        error: "Channel limit reached",
        details: `You have reached the maximum of ${limitStatus.limit} channels per bot on the ${limitStatus.planName} plan. Please upgrade.`,
      },
      { status: 403 },
    );
  }

  const { pageId, pageName, accessToken } = await req.json();

  if (!pageId || !pageName || !accessToken) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // Check if this bot already has a Facebook page connected
    const existingBotPage = await db.facebookPage.findFirst({
      where: { botId, tenantId },
    });

    if (existingBotPage && existingBotPage.facebookId !== pageId) {
      return NextResponse.json(
        {
          error: "Bot already has a Facebook page connected",
          details: "Each bot can only be connected to one Facebook page. To use a different page, please create a new bot.",
        },
        { status: 400 },
      );
    }

    const facebookPage = await db.facebookPage.upsert({
      where: { facebookId: pageId, tenantId: tenantId },
      update: {
        name: pageName,
        accessToken: accessToken,
        botId: botId, // Move to this bot
        tenantId: tenantId,
      },
      create: {
        facebookId: pageId,
        name: pageName,
        accessToken: accessToken,
        tenantId: tenantId,
        botId: botId,
        engineConnected: false,
      },
    });

    // Also sync to the generic Channel table for UI and Limit counting
    await db.channel.upsert({
      where: { 
        type_channelId: { 
          type: "facebook", 
          channelId: pageId 
        },
        tenantId: tenantId
      },
      update: {
        name: pageName,
        botId: botId,
        tenantId: tenantId,
        isActive: true,
        enabled: true,
      },
      create: {
        type: "facebook",
        channelId: pageId,
        name: pageName,
        botId: botId,
        tenantId: tenantId,
        isActive: true,
        enabled: true,
      }
    });

    await recordWebhookSetupLog({
      source: "facebook",
      event: "page_connect",
      outcome: "setup_success",
      tenantId: tenantId,
      channelId: pageId,
      metadata: { pageName, botId },
    });

    // Subscribe to webhooks
    let webhookSubscribed = false;
    try {
      const subUrl = getFacebookGraphUrl(
        `${pageId}/subscribed_apps`,
        accessToken,
        {
          subscribed_fields: "messages,messaging_postbacks,messaging_optins,messaging_referrals",
        },
      );
      const subRes = await fetch(subUrl, { method: "POST" });
      const subData = await subRes.json();
      if (subRes.ok && subData.success) {
        webhookSubscribed = true;
        await db.facebookPage.update({
          where: { id: facebookPage.id },
          data: { webhookSubscribed: true },
        });

        // PRODUCTION GRADE: Set up Messenger Profile (Get Started button, etc.)
        await setupMessengerProfile(pageId, accessToken);
      }
    } catch (subError) {
      console.error("[Facebook Connect] Webhook sub error:", subError);
    }

    return NextResponse.json({
      success: true,
      pageId,
      webhookSubscribed,
    });
  } catch (error) {
    console.error("[Facebook Connect] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
