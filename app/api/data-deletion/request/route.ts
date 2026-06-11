import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { validateApiKey } from "@/lib/api-auth";
import { sendDataDeletionEmails } from "@/lib/data-deletion-email";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

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

    let email: string | undefined;
    let source: string | undefined;
    try {
      const body = await req.json();
      email = body.email;
      source = body.source;
    } catch {
      // Body is empty or not JSON — session-based callers don't need to send one
    }

    const targetEmail = email || session?.user?.email;
    if (!targetEmail || !emailRegex.test(targetEmail)) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 },
      );
    }

    // Set a 7-day grace period for deletion
    const now = new Date();
    const scheduledDeletionAt = new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000,
    );
    const confirmationCode = `del_${crypto.randomBytes(12).toString("hex")}`;
    const cancelToken = `cancel_${crypto.randomBytes(16).toString("hex")}`;

    const request = await prisma.dataDeletionRequest.create({
      data: {
        email: targetEmail,
        confirmationCode,
        source: source || "web",
        userId: session?.user?.id || undefined,
        tenantId: session?.user?.tenantId || undefined,
        scheduledDeletionAt,
        cancelToken,
        // status defaults to PENDING
      },
      select: {
        email: true,
        confirmationCode: true,
        cancelToken: true,
        scheduledDeletionAt: true,
        status: true,
        requestedAt: true,
      },
    });

    if (request.cancelToken && request.scheduledDeletionAt) {
      await sendDataDeletionEmails.requested(
        request.email,
        request.confirmationCode,
        request.cancelToken,
        request.scheduledDeletionAt,
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://app.replybase.co.uk";

    return NextResponse.json({
      success: true,
      email: request.email,
      confirmationCode: request.confirmationCode,
      statusUrl: `${appUrl}/data-deletion-status?code=${request.confirmationCode}`,
      cancelUrl: `${appUrl}/api/data-deletion/cancel?token=${request.cancelToken}`,
      scheduledDeletionAt: request.scheduledDeletionAt,
      source: apiAuth.authenticated ? "api-key" : "session",
    });
  } catch (error: unknown) {
    console.error("[Data Deletion Request] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
