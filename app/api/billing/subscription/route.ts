import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession();
  if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First get user by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Then get subscription by userId
    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
      include: { plan: true },
    });

    if (!subscription) {
      // Ensure a free plan exists
      const freePlan = await prisma.plan.upsert({
        where: { name: "free" },
        update: {},
        create: {
          name: "free",
          displayName: "Free",
          price: 0,
          currency: "USD",
        },
      });

      const now = Date.now();
      const trialEndsAt = new Date(now + 14 * 24 * 60 * 60 * 1000); // 14 days
      const currentPeriodEnd = new Date(now + 30 * 24 * 60 * 60 * 1000); // 30 days

      const created = await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: freePlan.id,
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd,
          trialEndsAt,
        },
        include: { plan: true },
      });

      const trialDaysRemaining = Math.max(
        0,
        Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      );

      return NextResponse.json({
        ...created,
        trialDaysRemaining,
      });
    }

    const trialDaysRemaining = subscription.trialEndsAt
      ? Math.ceil(
          (subscription.trialEndsAt.getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    return NextResponse.json({
      ...subscription,
      trialDaysRemaining: Math.max(0, trialDaysRemaining),
    });
  } catch (error) {
    console.error("Subscription fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
