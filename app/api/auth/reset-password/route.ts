import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) {
    return NextResponse.json(
      { error: "Token and password required." },
      { status: 400 },
    );
  }

  const reset = await prisma.passwordResetToken.findUnique({
    where: { token },
  });
  if (!reset || reset.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Invalid or expired token." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: reset.userId },
    data: { passwordHash },
  });
  await prisma.passwordResetToken.delete({ where: { token } });

  return NextResponse.json({ success: true });
}
