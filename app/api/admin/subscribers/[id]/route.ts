import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "amirhossain.limon@gmail.com";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { planId, status, currentPeriodEnd } = body;

    const subscription = await prisma.subscription.update({
      where: { id: params.id },
      data: {
        ...(planId && { planId }),
        ...(status && { status }),
        ...(currentPeriodEnd && {
          currentPeriodEnd: new Date(currentPeriodEnd),
        }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("[Admin API] Error updating subscriber:", error);
    return NextResponse.json(
      { error: "Failed to update subscriber" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.subscription.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin API] Error deleting subscriber:", error);
    return NextResponse.json(
      { error: "Failed to delete subscriber" },
      { status: 500 },
    );
  }
}
