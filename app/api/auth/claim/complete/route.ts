import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendAccountActivationEmail } from "@/lib/email";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}***@${domain}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    if (!stripe) {
      return NextResponse.json(
        { error: "Billing service unavailable" },
        { status: 503 },
      );
    }

    // 1. Verify Stripe session is complete and is a claim session
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    if (checkoutSession.status !== "complete") {
      return NextResponse.json(
        { error: "Payment not yet completed" },
        { status: 400 },
      );
    }

    if (checkoutSession.metadata?.claimed !== "true") {
      return NextResponse.json(
        { error: "Invalid session type" },
        { status: 400 },
      );
    }

    const userId = checkoutSession.metadata?.userId;
    if (!userId) {
      return NextResponse.json(
        { error: "Session metadata missing" },
        { status: 400 },
      );
    }

    // 2. Fetch user and verify they still need to activate
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, accountClaimed: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (user.accountClaimed) {
      // Already activated (e.g. user refreshed this page after completing activation)
      return NextResponse.json({ success: true, alreadyClaimed: true });
    }

    // 3. Upsert a CLAIM token — safe to call multiple times (browser refresh / resend).
    //    @@unique([userId, type]) ensures only one CLAIM token exists per user at a time.
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.userToken.upsert({
      where: { userId_type: { userId: user.id, type: "CLAIM" } },
      update: { token, expiresAt },
      create: { userId: user.id, token, type: "CLAIM", expiresAt },
    });

    // 4. Send activation email — email ownership is proven by clicking this link,
    //    so activate route will also set emailVerified = now().
    if (user.email) {
      const emailResult = await sendAccountActivationEmail(user.email, token);
      if (!emailResult.ok) {
        logger.warn(
          { userId: user.id, error: emailResult.error },
          "[Claim Complete] Activation email failed to send",
        );
      }
    }

    const maskedEmail = user.email ? maskEmail(user.email) : "";
    return NextResponse.json({ success: true, maskedEmail });
  } catch (error) {
    logger.error({ error }, "[Claim Complete] Unhandled error");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
