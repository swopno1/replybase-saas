import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import { messageQueue } from "@/lib/queue";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    }
    event = stripe!.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Webhook] Signature verification failed: ${errorMessage}`);
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }

  // Idempotency & Audit Check
  const existingEvent = await prisma.stripeEvent.findUnique({
    where: { stripeEventId: event.id },
  });

  // Skip if already processed OR already queued (prevents double-processing on duplicate delivery)
  if (existingEvent && ["PROCESSED", "PENDING"].includes(existingEvent.status)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Log event for audit
  const auditLog = await prisma.stripeEvent.upsert({
    where: { stripeEventId: event.id },
    create: {
      stripeEventId: event.id,
      type: event.type,
      status: "PENDING",
      metadata: event.data.object as any,
    },
    update: {},
  });

  try {
    await messageQueue.add("stripe-event", {
      type: "stripe",
      botId: "system", // BotId is irrelevant for stripe, but required by type
      payload: { stripeEventId: event.id },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Enqueue failed";
    console.error(`[Webhook] Error enqueueing ${event.type}:`, errorMessage);
    
    await prisma.stripeEvent.update({
      where: { id: auditLog.id },
      data: { status: "FAILED", error: errorMessage },
    });

    return NextResponse.json(
      { error: "Webhook enqueue failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
