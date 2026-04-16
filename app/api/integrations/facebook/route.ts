import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { recordWebhookSetupLog } from "@/lib/webhook-setup-log";
import { isChannelEnabled } from "@/lib/channel-config";
import { generateAppSecretProof } from "@/lib/facebook-utils";

export const dynamic = "force-dynamic";

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

  const {
    pageId,
    pageName,
    accessToken,
    appSecret: providedSecret,
    accessTokenOnly,
  } = await req.json();

  if (!pageId || !pageName || !accessToken) {
    return NextResponse.json(
      { error: "Missing required fields: pageId, pageName, accessToken" },
      { status: 400 },
    );
  }

  // For OAuth flow, use environment secret
  const appSecret = accessTokenOnly
    ? process.env.FACEBOOK_CLIENT_SECRET
    : providedSecret;
  if (!appSecret) {
    return NextResponse.json(
      { error: "Facebook App Secret not configured" },
      { status: 500 },
    );
  }

  // Verify the page access token by fetching page info from Facebook Graph API
  try {
    const verifyUrl = new URL(`https://graph.facebook.com/v18.0/${pageId}`);
    verifyUrl.searchParams.set("fields", "id,name,access_token");
    verifyUrl.searchParams.set("access_token", accessToken);
    verifyUrl.searchParams.set(
      "appsecret_proof",
      generateAppSecretProof(accessToken, appSecret),
    );

    const verifyResponse = await fetch(verifyUrl.toString());

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error(
        "[Facebook Integration] Token verification failed:",
        errorText,
      );
      return NextResponse.json(
        { error: "Invalid page access token" },
        { status: 400 },
      );
    }

    const pageData = await verifyResponse.json();
    // Use the verified page ID and name from Facebook
    const verifiedPageId = pageData.id;
    const verifiedPageName = pageData.name || pageName;

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

    console.log(
      `[Facebook Integration] Page ${verifiedPageId} saved/updated for user ${userId}`,
    );

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

    return NextResponse.json({
      success: true,
      pageId: verifiedPageId,
      message: "Page connected successfully",
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
  // Allow cleanup even if channel gets toggled later.
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "User or Tenant ID missing" },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const pages = await tx.facebookPage.findMany({
        where: { tenantId },
        select: { id: true },
      });
      const pageIds = pages.map((p) => p.id);

      if (pageIds.length > 0) {
        await tx.flowAssignment.deleteMany({
          where: {
            pageId: { in: pageIds },
          },
        });

        await tx.crmConversation.deleteMany({
          where: {
            facebookPageId: { in: pageIds },
          },
        });

        await tx.lead.deleteMany({
          where: {
            pageId: { in: pageIds },
          },
        });

        await tx.flowSession.deleteMany({
          where: {
            pageId: { in: pageIds },
          },
        });

        await tx.onboardingSession.deleteMany({
          where: {
            facebookPageId: { in: pageIds },
          },
        });
      }

      const deletedPages = await tx.facebookPage.deleteMany({
        where: { tenantId },
      });

      const tenantUsers = await tx.user.findMany({
        where: { tenantId },
        select: { id: true },
      });
      const tenantUserIds = tenantUsers.map((u) => u.id);

      const deletedFacebookAccounts =
        tenantUserIds.length > 0
          ? await tx.account.deleteMany({
              where: {
                provider: "facebook",
                userId: { in: tenantUserIds },
              },
            })
          : { count: 0 };

      return {
        deletedPages: deletedPages.count,
        deletedFacebookAccounts: deletedFacebookAccounts.count,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Facebook disconnected and related data removed",
      ...result,
    });
  } catch (error) {
    console.error("[Facebook Integration] Error disconnecting all:", error);
    return NextResponse.json(
      {
        error: "Failed to disconnect Facebook",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
