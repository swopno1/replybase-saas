import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isPlatformAdmin } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin-audit";
import { invalidateTenantCache } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!isPlatformAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: tenantId } = await params;
    const body = await req.json();
    const { planId, status, currentPeriodEnd } = body;

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    // Check if subscription already exists
    const existingSubscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });

    const timestamp = new Date().getTime();
    const stripeId = `manual_grant_${timestamp}`;

    let subscription;

    if (existingSubscription) {
      subscription = await prisma.subscription.update({
        where: { tenantId },
        data: {
          planId,
          status: status ? status.toUpperCase() : "ACTIVE",
          currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
          updatedAt: new Date(),
        },
        include: { plan: true },
      });
    } else {
      subscription = await prisma.subscription.create({
        data: {
          tenantId,
          planId,
          stripeId, // Manual ID
          status: status ? status.toUpperCase() : "ACTIVE",
          currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        include: { plan: true },
      });
    }
    
    // Invalidate the cache so the user sees the new limits immediately
    await invalidateTenantCache(tenantId);

    // Audit Log
    await logAdminActivity({
      adminId: session.user.id,
      action: existingSubscription ? "SUBSCRIPTION_UPDATED" : "SUBSCRIPTION_CREATED",
      entityType: "SUBSCRIPTION",
      entityId: subscription.id,
      description: `Admin ${existingSubscription ? 'updated' : 'manually granted'} subscription for tenant ${tenantId}: Plan ${subscription.plan.name}, Status ${subscription.status}`,
      metadata: {
        tenantId,
        isManual: true,
        planId: subscription.planId,
        status: subscription.status,
      },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("[Admin API] Error granting subscription:", error);
    return NextResponse.json(
      { error: "Failed to grant subscription" },
      { status: 500 },
    );
  }
}
