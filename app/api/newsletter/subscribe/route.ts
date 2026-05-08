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

    // Determine the email to subscribe. For public marketing signups, 
    // we allow unauthenticated requests if an email is provided in the body.
    let email: string | undefined;
    let source: string = body.source || "web";

    if (apiAuth.authenticated) {
      // API key authentication
      email = requestEmail;
      source = body.source || "api";
    } else if (sessionEmail) {
      // Session authentication - can use session email or a provided email
      email = requestEmail || sessionEmail;
      source = requestEmail ? "web" : "account";
    } else if (requestEmail) {
      // Public signup (e.g. from footer)
      email = requestEmail;
      source = "web";
    }

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
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
