import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { recordWebhookSetupLog } from "@/lib/webhook-setup-log";
import { isChannelEnabled } from "@/lib/channel-config";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";
import { checkChannelLimit } from "@/lib/subscription";

export const dynamic = "force-dynamic";

// GET /api/bots/[botId]/channels/facebook - Get connected Facebook pages for this bot
export async function GET(
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
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const [pages, limitStatus] = await Promise.all([
    prisma.facebookPage.findMany({
      where: {
        tenantId: user.tenantId,
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
    checkChannelLimit(user.tenantId, botId),
  ]);

  return NextResponse.json({ pages, limitStatus });
}

// POST /api/bots/[botId]/channels/facebook - Connect a page to this specific bot
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

  // Verify bot belongs to tenant
  const bot = await prisma.bot.findFirst({
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
    const facebookPage = await prisma.facebookPage.upsert({
      where: { facebookId: pageId },
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
        await prisma.facebookPage.update({
          where: { id: facebookPage.id },
          data: { webhookSubscribed: true },
        });
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
}
