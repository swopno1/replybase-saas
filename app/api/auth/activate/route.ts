import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/server/password";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}***@${domain}`;
}

// GET — validate token before rendering the form.
// Returns masked email for display, or an error state the page can render.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { valid: false, error: "Missing activation token" },
      { status: 400 },
    );
  }

  const record = await prisma.userToken.findUnique({
    where: { token },
    select: {
      type: true,
      expiresAt: true,
      user: { select: { email: true, accountClaimed: true } },
    },
  });

  if (!record || record.type !== "CLAIM") {
    return NextResponse.json(
      { valid: false, error: "Invalid activation link" },
      { status: 404 },
    );
  }

  if (record.expiresAt < new Date()) {
    return NextResponse.json(
      { valid: false, error: "This activation link has expired" },
      { status: 410 },
    );
  }

  if (record.user.accountClaimed) {
    return NextResponse.json({ valid: false, alreadyClaimed: true });
  }

  const maskedEmail = record.user.email ? maskEmail(record.user.email) : "";
  return NextResponse.json({ valid: true, maskedEmail });
}

const activateSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// POST — set password and mark account as claimed.
// On success the client calls NextAuth signIn("credentials") using the returned email.
export async function POST(request: Request) {
  try {
    const parsed = activateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { token, password } = parsed.data;

    const record = await prisma.userToken.findUnique({
      where: { token },
      include: {
        user: { select: { id: true, email: true, accountClaimed: true } },
      },
    });

    if (!record || record.type !== "CLAIM") {
      return NextResponse.json(
        { error: "Invalid activation link" },
        { status: 404 },
      );
    }

    if (record.expiresAt < new Date()) {
      return NextResponse.json(
        {
          error:
            "This activation link has expired. Please contact support@replybase.co.uk.",
        },
        { status: 410 },
      );
    }

    if (record.user.accountClaimed) {
      // Idempotent — already activated; return success so client can sign in
      return NextResponse.json({
        success: true,
        email: record.user.email,
        alreadyClaimed: true,
      });
    }

    const passwordHash = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.user.id },
        data: {
          passwordHash,
          accountClaimed: true,
          // Clicking the email link constitutes email verification
          emailVerified: new Date(),
        },
      }),
      prisma.userToken.delete({ where: { token } }),
    ]);

    return NextResponse.json({ success: true, email: record.user.email });
  } catch (error) {
    logger.error({ error }, "[Activate] Unhandled error");
    return NextResponse.json(
      { error: "Unable to activate account. Please try again." },
      { status: 500 },
    );
  }
}
