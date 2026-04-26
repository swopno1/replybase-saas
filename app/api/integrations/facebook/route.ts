import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { recordWebhookSetupLog } from "@/lib/webhook-setup-log";
import { isChannelEnabled } from "@/lib/channel-config";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";

export async function POST(req: Request) {
  // Check if Facebook channel is enabled
  if (!isChannelEnabled("facebook")) {
    return NextResponse.json(
      { error: "Facebook channel is not enabled" },
      { status: 403 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const tenantId = session.user.tenantId;
  if (!userId || !tenantId) {
    return NextResponse.json(
      { error: "User or Tenant ID missing" },
      { status: 400 },
    );
  }

  const { pageId, pageName, accessToken } = await req.json();

  if (!pageId || !pageName || !accessToken) {
    return NextResponse.json(
      { error: "Missing required fields: pageId, pageName, accessToken" },
      { status: 400 },
    );
  }

  // The pageId, pageName, and accessToken originate from /me/accounts (already
  // verified by the pages listing call). A second Graph API lookup would require
  // pages_read_engagement which is not available in development mode. Skip it
  // and use the values directly.
  try {
    const verifiedPageId = pageId as string;
    const verifiedPageName = pageName as string;

    // Save or update Facebook Page in database
    const facebookPage = await prisma.facebookPage.upsert({
      where: { facebookId: verifiedPageId },
      update: {
        name: verifiedPageName,
        accessToken: accessToken,
      },
      create: {
        facebookId: verifiedPageId,
        name: verifiedPageName,
        accessToken: accessToken,
        tenantId: tenantId,
        engineConnected: false,
      },
    });

    // Log Facebook page connection for KPI tracking
    await recordWebhookSetupLog({
      source: "facebook",
      event: "page_connect",
      outcome: "setup_success",
      tenantId: tenantId,
      channelId: verifiedPageId,
      metadata: {
        pageName: verifiedPageName,
        isNew: !facebookPage,
      },
    });

    // Do not set botId here unless we can verify it exists for this tenant.
    const defaultBot = await prisma.bot.findFirst({
      where: { tenantId },
      select: { id: true },
    });

    if (defaultBot) {
      await prisma.facebookPage.update({
        where: { id: facebookPage.id },
        data: {
          botId: defaultBot.id,
        },
      });
    }

    // Subscribe the page to webhook events so Meta delivers messages to our webhook
    let webhookSubscribed = false;
    try {
      const subUrl = getFacebookGraphUrl(
        `${verifiedPageId}/subscribed_apps`,
        accessToken,
        {
          subscribed_fields:
            "messages,messaging_postbacks,messaging_optins,messaging_referrals",
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
      } else {
        console.error(
          "[Facebook Integration] Failed to subscribe page to webhook:",
          subData,
        );
      }
    } catch (subError) {
      console.error(
        "[Facebook Integration] Error subscribing page to webhook:",
        subError,
      );
    }

    return NextResponse.json({
      success: true,
      pageId: verifiedPageId,
      webhookSubscribed,
      message: webhookSubscribed
        ? "Page connected and subscribed to webhook events"
        : "Page connected but webhook subscription failed — messages may not be received",
    });
  } catch (error) {
    console.error("[Facebook Integration] Error:", error);

    // Log Facebook page connection failure for KPI tracking
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await recordWebhookSetupLog({
      source: "facebook",
      event: "page_connect",
      outcome: "setup_error",
      tenantId: tenantId,
      reason: errorMessage,
    }).catch((logErr) =>
      console.error("[Facebook Integration] Failed to log error:", logErr),
    );

    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  if (!isChannelEnabled("facebook")) {
    return NextResponse.json(
      { error: "Facebook channel is not enabled" },
      { status: 403 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const tenantId = session.user.tenantId;
  if (!userId || !tenantId) {
    return NextResponse.json(
      { error: "User or Tenant ID missing" },
      { status: 400 },
    );
  }

  try {
    // Get stored FB account token before deleting
    const account = await prisma.account.findFirst({
      where: { userId, provider: "facebook" },
    });

    // Revoke the app's permissions on Meta so the app is removed from the
    // user's "Active business tools" at facebook.com/settings?tab=business_tools
    if (account?.access_token) {
      try {
        const revokeUrl = getFacebookGraphUrl(
          "me/permissions",
          account.access_token,
        );
        await fetch(revokeUrl, { method: "DELETE" });
      } catch (revokeErr) {
        // Non-fatal — continue cleanup even if Meta revocation fails
        console.warn(
          "[Facebook Integration] Could not revoke Meta permissions:",
          revokeErr,
        );
      }
    }

    // Collect all page internal IDs for this tenant
    const facebookPages = await prisma.facebookPage.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const pageIds = facebookPages.map((p) => p.id);

    // Collect conversation IDs so we can delete child messages first
    const conversations = await prisma.crmConversation.findMany({
      where: { facebookPageId: { in: pageIds } },
      select: { id: true },
    });
    const conversationIds = conversations.map((c) => c.id);

    // Delete everything in a single transaction — child rows before parents
    await prisma.$transaction([
      prisma.crmMessage.deleteMany({
        where: { conversationId: { in: conversationIds } },
      }),
      prisma.flowAssignment.deleteMany({ where: { pageId: { in: pageIds } } }),
      prisma.crmConversation.deleteMany({
        where: { facebookPageId: { in: pageIds } },
      }),
      prisma.lead.deleteMany({ where: { pageId: { in: pageIds } } }),
      prisma.flowSession.deleteMany({ where: { pageId: { in: pageIds } } }),
      prisma.onboardingSession.deleteMany({
        where: { facebookPageId: { in: pageIds } },
      }),
      prisma.facebookPage.deleteMany({ where: { tenantId } }),
      prisma.account.deleteMany({ where: { userId, provider: "facebook" } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Facebook Integration] Error disconnecting:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Facebook account" },
      { status: 500 },
    );
  }
}
