import { NextRequest, NextResponse } from "next/server";
import { parseSignedRequest } from "@/lib/facebook-utils";
import { prisma } from "@/lib/prisma";
import { isChannelEnabled } from "@/lib/channel-config";

export async function POST(req: NextRequest) {
  // Check if Facebook channel is enabled
  if (!isChannelEnabled("facebook")) {
    console.warn("[Facebook Data Deletion] Channel is disabled");
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

    const userId = payload.user_id as string;
    const confirmationCode = `fb_${userId}_${Date.now()}`;

    await prisma.dataDeletionRequest.create({
      data: {
        email: `${userId}@facebook-user`,
        confirmationCode,
        source: "facebook",
      },
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://app.replybase.co.uk";

    return NextResponse.json({
      url: `${appUrl}/data-deletion-status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (error: unknown) {
    console.error("[Facebook Data Deletion] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
