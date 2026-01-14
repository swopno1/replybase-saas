import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

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
      { status: 400 }
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
      { status: 400 }
    );
  }

  // For OAuth flow, use environment secret
  const appSecret = accessTokenOnly
    ? process.env.FACEBOOK_CLIENT_SECRET
    : providedSecret;
  if (!appSecret) {
    return NextResponse.json(
      { error: "Facebook App Secret not configured" },
      { status: 500 }
    );
  }

  // Verify the page access token by fetching page info from Facebook Graph API
  try {
    const verifyResponse = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}?fields=id,name,access_token&access_token=${accessToken}`
    );

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error(
        "[Facebook Integration] Token verification failed:",
        errorText
      );
      return NextResponse.json(
        { error: "Invalid page access token" },
        { status: 400 }
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
        userId: userId,
      },
      create: {
        facebookId: verifiedPageId,
        name: verifiedPageName,
        accessToken: accessToken,
        userId: userId,
        tenantId: tenantId,
        engineConnected: false,
      },
    });

    console.log(
      `[Facebook Integration] Page ${verifiedPageId} saved/updated for user ${userId}`
    );

    // For MVP, use a default botId. In production, this would be resolved per workspace/user
    const botId = process.env.BOTPRESS_DEFAULT_BOT_ID || "test-bot";
    const bpToken = process.env.BOTPRESS_ADMIN_TOKEN;
    const bpUrl =
      process.env.NEXT_PUBLIC_ENGINE_URL || "http://replybase-botpress:3002";

    if (!bpToken) {
      console.error(
        "[Facebook Integration] BOTPRESS_ADMIN_TOKEN not configured"
      );
      // Still save the page even if engine config fails
      return NextResponse.json({
        success: true,
        warning: "Page saved but engine configuration skipped (missing token)",
      });
    }

    // Configure Botpress Messenger channel (optional for MVP - webhook handles routing)
    // Note: Botpress Messenger channel config is separate from our webhook routing
    try {
      const verifyToken =
        process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ||
        `replybase_verify_${Date.now()}`;

      const response = await fetch(
        `${bpUrl}/api/v1/admin/bots/${botId}/config/channel-messenger`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${bpToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            enabled: true,
            accessToken,
            appSecret,
            verifyToken,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        console.warn(
          "[Facebook Integration] Botpress config failed (non-critical):",
          err
        );
        // Continue anyway - webhook routing doesn't require Botpress channel config
      } else {
        console.log(
          `[Facebook Integration] Botpress channel configured for bot ${botId}`
        );
      }
    } catch (bpError) {
      console.warn(
        "[Facebook Integration] Botpress config error (non-critical):",
        bpError
      );
      // Continue anyway - webhook routing is independent
    }

    // Update page with botId and mark as engine connected
    await prisma.facebookPage.update({
      where: { id: facebookPage.id },
      data: {
        botId: botId,
        engineConnected: true,
      },
    });

    return NextResponse.json({
      success: true,
      pageId: verifiedPageId,
      message: "Page connected successfully",
    });
  } catch (error) {
    console.error("[Facebook Integration] Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
