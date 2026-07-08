import { NextRequest, NextResponse } from "next/server";
import { logAdminActivity } from "@/lib/admin-audit";
import { invalidateTenantCache, handlePlanChange } from "@/lib/subscription";
import { withAdmin } from "@/lib/route-helpers";
import { stripe } from "@/lib/stripe";

function isRealStripeId(stripeId: string | null): stripeId is string {
  return (
    !!stripeId &&
    !stripeId.startsWith("free_") &&
    !stripeId.startsWith("manual_grant_")
  );
}

async function cancelInStripe(stripeId: string): Promise<{ ok: boolean; alreadyGone?: boolean; error?: string }> {
  if (!stripe) return { ok: false, error: "Stripe not configured" };
  try {
    await stripe.subscriptions.cancel(stripeId);
    return { ok: true };
  } catch (err: any) {
    if (err?.code === "resource_missing") return { ok: true, alreadyGone: true };
    return { ok: false, error: err?.message ?? "Stripe error" };
  }
}

export const dynamic = "force-dynamic";

export const GET = withAdmin(async (session, request, context, db) => {
  try {
    const { id } = (await context.params) as { id: string };

    await logAdminActivity({
      adminId: session.user.id,
      action: "SUBSCRIBER_READ",
      entityType: "SUBSCRIBER",
      entityId: id,
      description: `Admin read subscriber details for: ${id}`,
      metadata: { id },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    let subscription: any = null;

    if (id.startsWith("no-sub-")) {
      const tenantId = id.replace("no-sub-", "");
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        include: {
          users: {
            select: { id: true, name: true, email: true, isAdmin: true, createdAt: true },
          },
          bots: {
            include: {
              channels: {
                include: {
                  flowAssignments: {
                    include: {
                      flow: {
                        select: { name: true }
                      }
                    }
                  }
                }
              }
            }
          },
          flows: { include: { _count: { select: { sessions: true, leads: true } } } },
          activityLogs: {
            take: 20,
            orderBy: { createdAt: "desc" },
            include: { user: { select: { name: true, email: true } } },
          },
        },
      });

      if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

      subscription = {
        id: `no-sub-${tenant.id}`,
        status: "inactive",
        currentPeriodEnd: null,
        stripeId: null,
        tenantId: tenant.id,
        planId: "free",
        plan: { id: "free", name: "No Active Plan", price: 0 },
        tenant,
      };
    } else {
      subscription = await db.subscription.findUnique({
        where: { id },
        include: {
          plan: true,
          tenant: {
            include: {
              users: {
                select: { id: true, name: true, email: true, isAdmin: true, createdAt: true },
              },
              bots: {
                include: {
                  channels: {
                    include: {
                      flowAssignments: {
                        include: {
                          flow: {
                            select: { name: true }
                          }
                        }
                      }
                    }
                  }
                }
              },
              flows: { include: { _count: { select: { sessions: true, leads: true } } } },
              activityLogs: {
                take: 20,
                orderBy: { createdAt: "desc" },
                include: { user: { select: { name: true, email: true } } },
              },
            },
          },
        },
      });
    }

    if (!subscription) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    // Fetch execution logs for the tenant's bots
    const botIds = subscription.tenant.bots.map((b: { id: string }) => b.id);
    const executionLogs = await db.executionLog.findMany({
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
});

export const PATCH = withAdmin(async (session, request, context, db) => {
  try {
    const { id } = (await context.params) as { id: string };
    const body = await request.json();
    const { planId, status, currentPeriodEnd, grantReason, stripeId } = body;

    // Normalize status to uppercase so getActiveSubscriptionWithPlan always finds it
    const normalizedStatus = status ? status.toUpperCase() : undefined;

    const oldSubscription = await db.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!oldSubscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    const subscription = await db.subscription.update({
      where: { id },
      data: {
        ...(planId && { planId }),
        ...(normalizedStatus && { status: normalizedStatus }),
        ...(currentPeriodEnd !== undefined && {
          currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
        }),
        ...(stripeId !== undefined && { stripeId }),
        updatedAt: new Date(),
      },
      include: { plan: true },
    });

    // If the plan changed, re-enable/disable bots and channels to match the new limits
    if (planId && planId !== oldSubscription.planId) {
      await handlePlanChange(subscription.tenantId, planId);
    }

    // Cancel in Stripe if admin is setting status to CANCELED and the sub has a real Stripe ID
    if (
      normalizedStatus === "CANCELED" &&
      oldSubscription.status !== "CANCELED" &&
      isRealStripeId(oldSubscription.stripeId)
    ) {
      const result = await cancelInStripe(oldSubscription.stripeId);
      if (!result.ok) {
        return NextResponse.json(
          { error: `Failed to cancel Stripe subscription: ${result.error}` },
          { status: 502 },
        );
      }
    }

    // Invalidate the cache so the user sees the new limits immediately
    await invalidateTenantCache(subscription.tenantId);
    
    // Audit Log
    const isSpecialGrant = subscription.stripeId?.startsWith("manual_grant_");
    await logAdminActivity({
      adminId: session.user.id,
      action: isSpecialGrant ? "SUBSCRIPTION_SPECIAL_GRANT" : "SUBSCRIPTION_UPDATED",
      entityType: "SUBSCRIPTION",
      entityId: subscription.id,
      description: isSpecialGrant
        ? `Admin granted special access to tenant ${subscription.tenantId}: Plan ${subscription.plan.name}${grantReason ? ` — Reason: ${grantReason}` : ""}`
        : `Admin updated subscription for tenant ${subscription.tenantId}: Plan ${oldSubscription.plan.name} -> ${subscription.plan.name}, Status ${oldSubscription.status} -> ${subscription.status}`,
      metadata: {
        tenantId: subscription.tenantId,
        ...(grantReason && { grantReason }),
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
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("[Admin API] Error updating subscriber:", error);
    return NextResponse.json(
      { error: "Failed to update subscriber" },
      { status: 500 },
    );
  }
});

export const DELETE = withAdmin(async (session, request, context, db) => {
  try {
    const { id } = (await context.params) as { id: string };

    const subscription = await db.subscription.findUnique({ where: { id } });
    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Cancel in Stripe immediately before removing the local record
    let stripeCanceled = false;
    if (isRealStripeId(subscription.stripeId)) {
      const result = await cancelInStripe(subscription.stripeId);
      if (!result.ok) {
        return NextResponse.json(
          { error: `Failed to cancel Stripe subscription: ${result.error}` },
          { status: 502 },
        );
      }
      stripeCanceled = !result.alreadyGone;
    }

    await db.subscription.delete({ where: { id } });

    await logAdminActivity({
      adminId: session.user.id,
      action: "SUBSCRIPTION_DELETED",
      entityType: "SUBSCRIPTION",
      entityId: id,
      description: `Admin deleted subscription for tenant ${subscription.tenantId}${stripeCanceled ? ` (Stripe sub ${subscription.stripeId} canceled immediately)` : ""}`,
      metadata: {
        tenantId: subscription.tenantId,
        stripeId: subscription.stripeId,
        stripeCanceled,
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ success: true, stripeCanceled });
  } catch (error) {
    console.error("[Admin API] Error deleting subscriber:", error);
    return NextResponse.json(
      { error: "Failed to delete subscriber" },
      { status: 500 },
    );
  }
});
