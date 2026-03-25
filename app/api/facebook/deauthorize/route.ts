import { NextRequest, NextResponse } from "next/server";
import { parseSignedRequest } from "@/lib/facebook-utils";
import { prisma } from "@/lib/prisma";
import { isChannelEnabled } from "@/lib/channel-config";

export const dynamic = 'force-dynamic';




export async function POST(req: NextRequest) {
  // Check if Facebook channel is enabled
  if (!isChannelEnabled("facebook")) {
    console.warn("[Facebook Deauthorization] Channel is disabled");
    return NextResponse.json(
      { error: "Facebook channel is not enabled" },
      { status: 403 },
    );
  }

  try {
    const formData = await req.formData();
    const signedRequest = formData.get("signed_request") as string;

    if (!signedRequest) {
      return NextResponse.json(
        { error: "Missing signed_request" },
        { status: 400 },
      );
    }

    const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
    if (!appSecret) {
      console.error("FACEBOOK_CLIENT_SECRET not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const payload = parseSignedRequest(signedRequest, appSecret);
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid signed_request" },
        { status: 400 },
      );
    }

    const facebookUserId = payload.user_id;
    console.log(
      `[Facebook Deauthorization] received for FB User ID: ${facebookUserId}`,
    );

    // Find the user associated with this Facebook ID
    const account = await prisma.account.findFirst({
      where: {
        provider: "facebook",
        providerAccountId: facebookUserId,
      },
      include: { user: { select: { tenantId: true } } },
    });

    if (account && account.user) {
      const tenantId = account.user.tenantId;
      console.log(
        `[Facebook Deauthorization] Disabling engine for Tenant ID: ${tenantId}`,
      );

      // Find all Facebook pages connected to this tenant
      const pages = await prisma.facebookPage.findMany({
        where: { tenantId: tenantId },
        select: { id: true },
      });

      if (pages.length > 0) {
        const pageIds = pages.map((p) => p.id);
        // Disable engine connection for all pages of the tenant
        await prisma.facebookPage.updateMany({
          where: { id: { in: pageIds } },
          data: { engineConnected: false },
        });
        console.log(
          `[Facebook Deauthorization] Disabled engine for ${pages.length} pages in tenant ${tenantId}`,
        );
      }
    } else {
      console.warn(
        `[Facebook Deauthorization] No matching user or tenant found for FB User ID: ${facebookUserId}`,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Facebook Deauthorization] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
