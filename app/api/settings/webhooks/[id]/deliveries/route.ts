import { NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const GET = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  const { id } = await context.params;
  const subscriptionId = id as string;

  // Verify the subscription belongs to this tenant
  const subscription = await db.webhookSubscription.findFirst({
    where: { id: subscriptionId, tenantId },
    select: { id: true },
  });

  if (!subscription) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const logs = await (db as any).webhookDeliveryLog.findMany({
    where: { subscriptionId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      eventType: true,
      statusCode: true,
      success: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  return NextResponse.json(logs);
});
