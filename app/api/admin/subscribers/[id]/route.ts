import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isPlatformAdmin } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!isPlatformAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        plan: true,
        tenant: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                isAdmin: true,
                createdAt: true,
              },
            },
            bots: {
              include: {
                channels: true,
              },
            },
            flows: {
              include: {
                _count: {
                  select: { sessions: true, leads: true },
                },
              },
            },
            activityLogs: {
              take: 20,
              orderBy: { createdAt: "desc" },
              include: {
                user: {
                  select: { name: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    // Fetch execution logs for the tenant's bots
    const botIds = subscription.tenant.bots.map((b) => b.id);
    const executionLogs = await prisma.executionLog.findMany({
      where: {
        botId: { in: botIds },
      },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        bot: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({
      subscription,
      executionLogs,
    });
  } catch (error) {
    console.error("[Admin API] Error fetching subscriber:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriber" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!isPlatformAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { planId, status, currentPeriodEnd } = body;

    const oldSubscription = await prisma.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!oldSubscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    const subscription = await prisma.subscription.update({
      where: { id },
      data: {
        ...(planId && { planId }),
        ...(status && { status }),
        ...(currentPeriodEnd !== undefined && {
          currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
        }),
        updatedAt: new Date(),
      },
      include: { plan: true },
    });

    // Audit Log
    await recordActivity({
      tenantId: subscription.tenantId,
      userId: session.user.id,
      type: "subscription_updated",
      title: "Subscription Updated by Admin",
      description: `Admin updated subscription: Plan ${oldSubscription.plan.name} -> ${subscription.plan.name}, Status ${oldSubscription.status} -> ${subscription.status}`,
      metadata: {
        previous: {
          planId: oldSubscription.planId,
          status: oldSubscription.status,
          currentPeriodEnd: oldSubscription.currentPeriodEnd,
        },
        updated: {
          planId: subscription.planId,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!isPlatformAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.subscription.delete({
      where: { id },
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
