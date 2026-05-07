import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { recordWebhookSetupLog } from "@/lib/webhook-setup-log";
import { isChannelEnabled } from "@/lib/channel-config";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";

export async function POST(req: Request) {
  if (!isChannelEnabled("facebook")) {
    return NextResponse.json({ error: "Facebook channel is not enabled" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const tenantId = session.user.tenantId;
  if (!userId || !tenantId) {
    return NextResponse.json({ error: "User or Tenant ID missing" }, { status: 400 });
  }

  const { pageId, pageName, accessToken } = await req.json();
  if (!pageId || !pageName || !accessToken) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const defaultBot = await prisma.bot.findFirst({
      where: { tenantId },
      select: { id: true },
    });

    if (!defaultBot) {
      return NextResponse.json({ error: "No bot found for tenant. Create a bot first." }, { status: 400 });
    }

    const facebookPage = await prisma.facebookPage.upsert({
      where: { facebookId: pageId },
      update: {
        name: pageName,
        accessToken,
        botId: defaultBot.id,
      },
      create: {
        facebookId: pageId,
        name: pageName,
        accessToken,
        tenantId,
        botId: defaultBot.id,
        engineConnected: false,
      },
    });

    await recordWebhookSetupLog({
      source: "facebook",
      event: "page_connect",
      outcome: "setup_success",
      tenantId,
      channelId: pageId,
      metadata: { pageName, isNew: !facebookPage },
    });

    let webhookSubscribed = false;
    try {
      const subUrl = getFacebookGraphUrl(`${pageId}/subscribed_apps`, accessToken, {
        subscribed_fields: "messages,messaging_postbacks,messaging_optins,messaging_referrals",
      });
      const subRes = await fetch(subUrl, { method: "POST" });
      if (subRes.ok) {
        webhookSubscribed = true;
        await prisma.facebookPage.update({
          where: { id: facebookPage.id },
          data: { webhookSubscribed: true },
        });
      }
    } catch {}

    return NextResponse.json({ success: true, pageId, webhookSubscribed });
  } catch (error) {
    console.error("[Facebook Integration] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE() {
  if (!isChannelEnabled("facebook")) return NextResponse.json({ error: "Disabled" }, { status: 403 });

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const tenantId = session.user.tenantId;

  try {
    const account = await prisma.account.findFirst({ where: { userId, provider: "facebook" } });
    if (account?.access_token) {
      try {
        const revokeUrl = getFacebookGraphUrl("me/permissions", account.access_token);
        await fetch(revokeUrl, { method: "DELETE" });
      } catch {}
    }

    const facebookPages = await prisma.facebookPage.findMany({ where: { tenantId }, select: { id: true } });
    const pageIds = facebookPages.map((p) => p.id);
    const conversations = await prisma.crmConversation.findMany({ where: { facebookPageId: { in: pageIds } }, select: { id: true } });
    const conversationIds = conversations.map((c) => c.id);

    await prisma.$transaction([
      prisma.crmMessage.deleteMany({ where: { conversationId: { in: conversationIds } } }),
      prisma.flowAssignment.deleteMany({ where: { pageId: { in: pageIds } } }),
      prisma.crmConversation.deleteMany({ where: { facebookPageId: { in: pageIds } } }),
      prisma.lead.deleteMany({ where: { pageId: { in: pageIds } } }),
      prisma.flowSession.deleteMany({ where: { pageId: { in: pageIds } } }),
      prisma.onboardingSession.deleteMany({ where: { facebookPageId: { in: pageIds } } }),
      prisma.facebookPage.deleteMany({ where: { tenantId } }),
      prisma.account.deleteMany({ where: { userId, provider: "facebook" } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
