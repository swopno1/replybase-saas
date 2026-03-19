import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { recordWebhookSetupLog } from "@/lib/webhook-setup-log";

export async function POST(req: Request) {
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
    const verifyResponse = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}?fields=id,name,access_token&access_token=${accessToken}`,
    );

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
