import crypto from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/server/password";
import { sendEmailVerificationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

type SignupPlanIntent = "free" | "launch" | "grow" | "scale" | "business";

function parseSignupPlanIntent(value: unknown): SignupPlanIntent | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "free" ||
    normalized === "launch" ||
    normalized === "grow" ||
    normalized === "scale" ||
    normalized === "business"
  ) {
    return normalized as SignupPlanIntent;
  }

  return null;
}

function parseSignupSourceIntent(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,48}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function getDisplayName(firstName: string, lastName: string): string {
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || "New User";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const firstName = String(body?.firstName ?? "").trim();
    const lastName = String(body?.lastName ?? "").trim();
    const email = String(body?.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body?.password ?? "");
    const signupPlanIntent = parseSignupPlanIntent(body?.signupPlanIntent);
    const signupSourceIntent = parseSignupSourceIntent(
      body?.signupSourceIntent,
    );

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: `${getDisplayName(firstName, lastName)}'s Workspace`,
          leadNotificationSettings: {
            create: {
              emailRecipients: [email],
            },
          },
        },
        select: { id: true },
      });

      const createdUser = await tx.user.create({
        data: {
          name: getDisplayName(firstName, lastName),
          email,
          passwordHash,
          tenantId: tenant.id,
        },
        select: { id: true },
      });

      await tx.userToken.create({
        data: {
          userId: createdUser.id,
          token: verificationToken,
          type: "EMAIL_VERIFY",
          expiresAt: tokenExpiresAt,
        },
      });

      if (signupPlanIntent || signupSourceIntent) {
        await tx.activityLog.create({
          data: {
            tenantId: tenant.id,
            userId: createdUser.id,
            type: "signup_intent",
            title: "Signup intent captured",
            description:
              "Captured plan/source intent from pre-signup CTA to personalize onboarding.",
            entityType: "signup",
            entityId: createdUser.id,
            metadata: {
              plan: signupPlanIntent,
              source: signupSourceIntent,
            },
          },
        });
      }
    });

    // Send verification email outside the transaction
    sendEmailVerificationEmail(email, verificationToken).catch((err) => {
      console.error("[Register] Failed to send verification email:", err);
    });

    return NextResponse.json(
      { success: true, requiresVerification: true },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Unable to register right now. Please try again." },
      { status: 500 },
    );
  }
}
