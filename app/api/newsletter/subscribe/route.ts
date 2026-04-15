import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const apiAuth = validateApiKey(req);
    const body = (await req.json()) as { email?: string; source?: string };
    const requestEmail = body.email?.trim().toLowerCase();
    const sessionEmail = session?.user?.email?.trim().toLowerCase();

    if (!apiAuth.authenticated && !sessionEmail) {
      return NextResponse.json(
        { error: "Unauthorized. Sign in or provide a valid API key" },
        { status: 401 },
      );
    }

    const email = apiAuth.authenticated ? requestEmail : sessionEmail;
    const source = apiAuth.authenticated ? body.source : "account";

    if (
      !apiAuth.authenticated &&
      requestEmail &&
      requestEmail !== sessionEmail
    ) {
      return NextResponse.json(
        { error: "Forbidden. You can only subscribe your own account email" },
        { status: 403 },
      );
    }

    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 },
      );
    }

    const existingSubscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (existingSubscriber?.status === "SUBSCRIBED") {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://app.replybase.co.uk";
      const unsubscribeUrl = `${appUrl}/newsletter/unsubscribe?token=${existingSubscriber.unsubscribeToken}`;

      return NextResponse.json({
        success: true,
        alreadySubscribed: true,
        message: "You are already subscribed to the newsletter.",
        subscriberId: existingSubscriber.id,
        email: existingSubscriber.email,
        unsubscribeUrl,
        source: apiAuth.authenticated ? "api-key" : "session",
      });
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
      source: apiAuth.authenticated ? "api-key" : "session",
    });
  } catch (error: unknown) {
    console.error("[Newsletter Subscribe] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
