import { NextRequest, NextResponse } from "next/server";
import { logAdminActivity } from "@/lib/admin-audit";
import { invalidateTenantCache } from "@/lib/subscription";
import { withAdmin } from "@/lib/route-helpers";

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
    const { planId, status, currentPeriodEnd } = body;

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
        ...(status && { status }),
        ...(currentPeriodEnd !== undefined && {
          currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
        }),
        updatedAt: new Date(),
      },
      include: { plan: true },
    });
    
    // Invalidate the cache so the user sees the new limits immediately
    await invalidateTenantCache(subscription.tenantId);
    
    // Audit Log
    await logAdminActivity({
      adminId: session.user.id,
      action: "SUBSCRIPTION_UPDATED",
      entityType: "SUBSCRIPTION",
      entityId: subscription.id,
      description: `Admin updated subscription for tenant ${subscription.tenantId}: Plan ${oldSubscription.plan.name} -> ${subscription.plan.name}, Status ${oldSubscription.status} -> ${subscription.status}`,
      metadata: {
        tenantId: subscription.tenantId,
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
 
    await db.subscription.delete({
      where: { id },
    });
 
    await logAdminActivity({
      adminId: session.user.id,
      action: "SUBSCRIPTION_DELETED",
      entityType: "SUBSCRIPTION",
      entityId: id,
      description: `Admin deleted subscription for tenant ${subscription.tenantId}`,
      metadata: {
        tenantId: subscription.tenantId,
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });
 
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin API] Error deleting subscriber:", error);
    return NextResponse.json(
      { error: "Failed to delete subscriber" },
      { status: 500 },
    );
  }
});
