import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pageId } = await params;
  const tenantId = session.user.tenantId;

  try {
    const facebookPage = await prisma.facebookPage.findFirst({
      where: {
        facebookId: pageId,
        tenantId: tenantId,
      },
    });

    if (!facebookPage || !facebookPage.accessToken) {
      return NextResponse.json(
        { error: "Facebook page not found or not connected" },
        { status: 404 },
      );
    }

    // 1. Verify token validity and permissions
    const meUrl = getFacebookGraphUrl("me", facebookPage.accessToken, {
      fields: "id,name,permissions",
    });

    const meRes = await fetch(meUrl);
    const meData = await meRes.json();
    const tokenValid = meRes.ok;

    const requiredPermissions = [
      "pages_messaging",
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_metadata",
    ];
    const grantedPermissions =
      meData.permissions?.data
        ?.filter((p: { status: string }) => p.status === "granted")
        .map((p: { permission: string }) => p.permission) || [];

    const missingPermissions = requiredPermissions.filter(
      (p) => !grantedPermissions.includes(p),
    );

    // 2. Check webhook subscription status
    const subUrl = getFacebookGraphUrl(
      `${pageId}/subscribed_apps`,
      facebookPage.accessToken,
    );
    const subRes = await fetch(subUrl);
    let webhookSubscribed = false;

    if (subRes.ok) {
      const subData = await subRes.json();
      webhookSubscribed = subData.data?.some(
        (app: { id: string }) => app.id === process.env.FACEBOOK_CLIENT_ID,
      );
    }

    // Update DB if status changed
    if (webhookSubscribed !== facebookPage.webhookSubscribed) {
      await prisma.facebookPage.update({
        where: { id: facebookPage.id },
        data: { webhookSubscribed },
      });
    }

    return NextResponse.json({
      success: true,
      tokenValid,
      webhookSubscribed,
      missingPermissions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Facebook Diagnostics] Error:", error);
    return NextResponse.json(
      { error: "Failed to perform diagnostics" },
      { status: 500 },
    );
  }
}
