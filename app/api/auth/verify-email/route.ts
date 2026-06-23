import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { APP_CONFIG } from "@/lib/config";
import { sendEmailVerificationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * GET ?token=xxx  — verify email via link clicked in inbox
 * GET ?check=true&email=xxx  — poll: has this email been verified yet?
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const check = searchParams.get("check");
  const emailParam = searchParams.get("email");

  // ── Token verification (email link click) ─────────────────────────────────
  if (token) {
    const record = await prisma.userToken.findUnique({
      where: { token },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    if (!record || record.type !== "EMAIL_VERIFY") {
      return NextResponse.redirect(
        `${APP_CONFIG.meta.baseUrl}/auth/login?verified=error`,
      );
    }

    if (record.expiresAt < new Date()) {
      return NextResponse.redirect(
        `${APP_CONFIG.meta.baseUrl}/auth/login?verified=expired`,
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: new Date() },
      }),
      prisma.userToken.delete({ where: { token } }),
    ]);

    const email = encodeURIComponent(record.user.email ?? "");
    return NextResponse.redirect(
      `${APP_CONFIG.meta.baseUrl}/auth/login?verified=true&email=${email}`,
    );
  }

  // ── Poll check (verify-email page polling) ────────────────────────────────
  if (check === "true" && emailParam) {
    const user = await prisma.user.findUnique({
      where: { email: emailParam.toLowerCase().trim() },
      select: { emailVerified: true },
    });

    return NextResponse.json({ verified: !!user?.emailVerified });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

/**
 * POST { email }  — resend verification email (rate-limited to once per 60s)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? "")
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });

    if (!user) {
      // Don't reveal whether an account exists
      return NextResponse.json({ success: true });
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "This email address is already verified." },
        { status: 400 },
      );
    }

    // Rate limit: one resend per 60 seconds
    const existing = await prisma.userToken.findUnique({
      where: { userId_type: { userId: user.id, type: "EMAIL_VERIFY" } },
      select: { createdAt: true },
    });

    if (existing) {
      const secondsSinceCreated =
        (Date.now() - existing.createdAt.getTime()) / 1000;
      if (secondsSinceCreated < 60) {
        return NextResponse.json(
          {
            error: "Please wait a moment before requesting another email.",
            retryAfter: Math.ceil(60 - secondsSinceCreated),
          },
          { status: 429 },
        );
      }
    }

    const newToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.userToken.upsert({
      where: { userId_type: { userId: user.id, type: "EMAIL_VERIFY" } },
      update: { token: newToken, expiresAt, createdAt: new Date() },
      create: {
        userId: user.id,
        token: newToken,
        type: "EMAIL_VERIFY",
        expiresAt,
      },
    });

    await sendEmailVerificationEmail(email, newToken);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to resend verification email." },
      { status: 500 },
    );
  }
}
