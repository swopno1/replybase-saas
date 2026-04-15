import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { validateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

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

  if (subscriber.status === "UNSUBSCRIBED") {
    return NextResponse.json({
      success: true,
      alreadyUnsubscribed: true,
      message: "You are already unsubscribed from the newsletter.",
      subscriber,
    });
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
    const session = await getServerSession(authOptions);
    const apiAuth = validateApiKey(req);
    const body = (await req.json()) as { email?: string; token?: string };
    const token = body.token?.trim();
    const requestEmail = body.email?.trim().toLowerCase();
    const sessionEmail = session?.user?.email?.trim().toLowerCase();

    const canUseEmail = apiAuth.authenticated || Boolean(sessionEmail);
    const resolvedEmail = apiAuth.authenticated
      ? requestEmail
      : sessionEmail || undefined;

    if (!resolvedEmail && !token) {
      return NextResponse.json(
        { error: "Email or token is required" },
        { status: 400 },
      );
    }

    // Token-based unsubscribe is the public flow used in newsletter footers.
    // Email-based unsubscribe requires API key or authenticated session.
    if (!token && !canUseEmail) {
      return NextResponse.json(
        {
          error:
            "Unauthorized. Sign in, provide API key, or use an unsubscribe token",
        },
        { status: 401 },
      );
    }

    if (
      !apiAuth.authenticated &&
      requestEmail &&
      requestEmail !== sessionEmail
    ) {
      return NextResponse.json(
        {
          error: "Forbidden. You can only unsubscribe your own account email",
        },
        { status: 403 },
      );
    }

    const subscriber = token
      ? await prisma.newsletterSubscriber.findUnique({
          where: { unsubscribeToken: token },
        })
      : await prisma.newsletterSubscriber.findUnique({
          where: { email: resolvedEmail },
        });

    if (!subscriber) {
      if (!token) {
        return NextResponse.json({
          success: true,
          alreadyUnsubscribed: true,
          message: "You are not subscribed to the newsletter.",
          email: resolvedEmail,
          source: apiAuth.authenticated ? "api-key" : "session",
        });
      }

      return NextResponse.json(
        { error: "Subscriber not found" },
        { status: 404 },
      );
    }

    if (subscriber.status === "UNSUBSCRIBED") {
      return NextResponse.json({
        success: true,
        alreadyUnsubscribed: true,
        message: "You are already unsubscribed from the newsletter.",
        email: subscriber.email,
        source: token ? "token" : apiAuth.authenticated ? "api-key" : "session",
      });
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
      alreadyUnsubscribed: false,
      message: "Unsubscribed from newsletter",
      source: token ? "token" : apiAuth.authenticated ? "api-key" : "session",
    });
  } catch (error: unknown) {
    console.error("[Newsletter Unsubscribe] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
