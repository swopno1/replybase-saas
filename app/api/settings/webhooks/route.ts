import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";

const webhookSubscriptionSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  eventTypes: z.array(z.string()).min(1),
  secret: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const GET = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const webhooks = await db.webhookSubscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(webhooks);
  } catch (error) {
    console.error("[Webhooks API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
  }
});

export const POST = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const body = await request.json();
    const parsed = webhookSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }

    const webhook = await db.webhookSubscription.create({
      data: {
        ...parsed.data,
        tenantId,
      },
    });

    return NextResponse.json(webhook, { status: 201 });
  } catch (error) {
    console.error("[Webhooks API] POST error:", error);
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
  }
});

export const PATCH = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const { id, ...data } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Webhook ID is required" }, { status: 400 });
    }

    const parsed = webhookSubscriptionSchema.partial().safeParse(data);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }

    const webhook = await db.webhookSubscription.update({
      where: { id, tenantId },
      data: parsed.data,
    });

    return NextResponse.json(webhook);
  } catch (error) {
    console.error("[Webhooks API] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
  }
});

export const DELETE = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Webhook ID is required" }, { status: 400 });
    }

    await db.webhookSubscription.delete({
      where: { id, tenantId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Webhooks API] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
});
