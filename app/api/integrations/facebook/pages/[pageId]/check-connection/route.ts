import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";

export const dynamic = "force-dynamic";

export const GET = withAuthAndTenant(
  async ({ tenantId }, req, context, db) => {
    const { pageId } = await context.params;

    try {
      const facebookPage = await db.facebookPage.findFirst({
        where: {
          facebookId: pageId as string,
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
        await db.facebookPage.update({
          where: { id: facebookPage.id, tenantId },
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
);
