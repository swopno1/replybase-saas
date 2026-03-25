import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';




const ADMIN_EMAIL = "amirhossain.limon@gmail.com";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (
    !session?.user?.id ||
    (!session.user.isAdmin && session.user.email !== ADMIN_EMAIL)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "You cannot change your own admin status" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const { isAdmin } = body;

  if (typeof isAdmin !== "boolean") {
    return NextResponse.json(
      { error: "isAdmin must be a boolean" },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isAdmin },
    select: { id: true, name: true, email: true, isAdmin: true },
  });

  return NextResponse.json({ user: updated });
}
