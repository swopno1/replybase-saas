import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/server/password";

export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters.")
    .max(128, "Password is too long."),
});

export const PATCH = withAuthAndTenant(async (user, request) => {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 422 },
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (!dbUser.passwordHash) {
    return NextResponse.json(
      {
        error:
          "Your account uses social login (Google or Facebook). Password changes are managed through your provider.",
        code: "oauth_account",
      },
      { status: 400 },
    );
  }

  const isValid = await verifyPassword(currentPassword, dbUser.passwordHash);
  if (!isValid) {
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 400 },
    );
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "New password must be different from your current password." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
});
