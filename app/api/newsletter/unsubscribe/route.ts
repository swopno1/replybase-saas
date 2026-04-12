import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
    const apiAuth = validateApiKey(req);

    const { email, token } = await req.json();

    if (!email && !token) {
      return NextResponse.json(
        { error: "Email or token is required" },
        { status: 400 },
      );
    }

    // Token-based unsubscribe is the public flow used in newsletter footers.
    // Email-based unsubscribe requires API key to prevent arbitrary opt-outs.
    if (!token && !apiAuth.authenticated) {
      return NextResponse.json(
        {
          error: "Unauthorized. Provide valid API key or unsubscribe token",
        },
        { status: 401 },
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
      source: token ? "token" : "api-key",
    });
  } catch (error: unknown) {
    console.error("[Newsletter Unsubscribe] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
