import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { validateApiKey } from "@/lib/api-auth";
import crypto from "node:crypto";

export const dynamic = 'force-dynamic';




const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    // Support both API key (from marketing site) and user session (from SaaS app)
    const apiAuth = validateApiKey(req);
    const session = await getServerSession(authOptions);

    if (!apiAuth.authenticated && !session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Provide valid API key or user session" },
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
        userId: session?.user?.id || undefined,
        tenantId: session?.user?.tenantId || undefined,
      },
      create: {
        email,
        status: "SUBSCRIBED",
        source: source || "web",
        unsubscribeToken,
        userId: session?.user?.id || undefined,
        tenantId: session?.user?.tenantId || undefined,
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
