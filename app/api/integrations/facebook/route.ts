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
      `[Facebook Integration] Page ${verifiedPageId} saved/updated for user ${userId}`
    );

    // For Typebot, the "botId" in our DB usually maps to the Typebot Public ID or Typebot ID.
    // We assume a default one is set in env or provided (for MVP, we use default).
    const botId = process.env.TYPEBOT_DEFAULT_BOT_ID || "my-typebot";

    // Update page with botId and mark as engine connected (Typebot doesn't need explicit channel config)
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
