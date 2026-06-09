import { NextRequest, NextResponse } from "next/server";
import { logAdminActivity } from "@/lib/admin-audit";
import { handlePlanChange, invalidateTenantCache } from "@/lib/subscription";
import { withAdmin } from "@/lib/route-helpers";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (session, request, context, db) => {
  try {
    const { id: tenantId } = (await context.params) as { id: string };
    const body = await request.json();
    const { planId, status, currentPeriodEnd } = body;

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    // Check if subscription already exists
    const existingSubscription = await db.subscription.findUnique({
      where: { tenantId },
    });

    const timestamp = new Date().getTime();
    const stripeId = `manual_grant_${timestamp}`;

    let subscription;

    if (existingSubscription) {
      subscription = await db.subscription.update({
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
      subscription = await db.subscription.create({
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
    
    // Adjust bots/channels to match new plan limits (handles both upgrade and downgrade)
    await handlePlanChange(tenantId, planId);

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
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ subscription });
  } catch (error) {
    logger.error({ tenantId: (await context.params as any).id, error }, "[Admin] Error granting subscription");
    return NextResponse.json(
      { error: "Failed to grant subscription" },
      { status: 500 },
    );
  }
});
