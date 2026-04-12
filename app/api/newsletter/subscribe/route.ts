import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-auth";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    // Newsletter subscribe must come from trusted server-side callers
    // (e.g. marketing site server action) using API secret.
    const apiAuth = validateApiKey(req);

    if (!apiAuth.authenticated) {
      return NextResponse.json(
        { error: "Unauthorized. Provide valid API key" },
        { status: 401 },
      );
    }

    const { email, source } = await req.json();
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 },
      );
    }

    const unsubscribeToken = crypto.randomBytes(24).toString("hex");

    const subscriber = await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: {
        status: "SUBSCRIBED",
        subscribedAt: new Date(),
        unsubscribedAt: null,
        source: source || "web",
        unsubscribeToken,
      },
      create: {
        email,
        status: "SUBSCRIBED",
        source: source || "web",
        unsubscribeToken,
      },
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://app.replybase.co.uk";
    const unsubscribeUrl = `${appUrl}/newsletter/unsubscribe?token=${subscriber.unsubscribeToken}`;

    return NextResponse.json({
      success: true,
      subscriberId: subscriber.id,
      email: subscriber.email,
      unsubscribeUrl,
      source: "api-key",
    });
  } catch (error: unknown) {
    console.error("[Newsletter Subscribe] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
