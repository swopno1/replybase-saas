import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { validateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';




export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { unsubscribeToken: token },
  });

  if (!subscriber) {
    return NextResponse.json(
      { error: "Subscriber not found" },
      { status: 404 },
    );
  }

  const updated = await prisma.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: {
      status: "UNSUBSCRIBED",
      unsubscribedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, subscriber: updated });
}

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

    const { email, token } = await req.json();

    if (!email && !token) {
      return NextResponse.json(
        { error: "Email or token is required" },
        { status: 400 },
      );
    }

    const subscriber = token
      ? await prisma.newsletterSubscriber.findUnique({
          where: { unsubscribeToken: token },
        })
      : await prisma.newsletterSubscriber.findUnique({ where: { email } });

    if (!subscriber) {
      return NextResponse.json(
        { error: "Subscriber not found" },
        { status: 404 },
      );
    }

    const updated = await prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: {
        status: "UNSUBSCRIBED",
        unsubscribedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      email: updated.email,
      source: apiAuth.authenticated ? "api-key" : "session",
    });

    return NextResponse.json({ success: true, subscriber: updated });
  } catch (error: unknown) {
    console.error("[Newsletter Unsubscribe] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
