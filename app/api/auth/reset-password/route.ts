import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/server/password";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const { token, password } = parsed.data;

  const reset = await prisma.passwordResetToken.findUnique({
    where: { token },
    select: { userId: true, expiresAt: true },
  });

  if (!reset) {
    return NextResponse.json(
      { error: "Invalid or expired token." },
      { status: 400 },
    );
  }

  if (reset.expiresAt < new Date()) {
    // Clean up the stale token so it doesn't accumulate
    await prisma.passwordResetToken.deleteMany({ where: { userId: reset.userId } });
    return NextResponse.json(
      { error: "This reset link has expired. Please request a new one." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: {
        passwordHash,
        // Possessing the reset token proves email ownership
        emailVerified: new Date(),
      },
    }),
    // Invalidate all reset tokens for this user, not just the used one
    prisma.passwordResetToken.deleteMany({ where: { userId: reset.userId } }),
  ]);

  return NextResponse.json({ success: true });
}
