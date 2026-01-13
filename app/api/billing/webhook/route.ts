import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe, PLANS } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Extend Stripe types to include the properties we need
interface ExtendedStripeSubscription extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
  trial_end: number | null;
}

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 500 }
    );
  }

  if (!endpointSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await req.text();
    const headersList = await headers();
    const sig = headersList.get("stripe-signature");

    if (!sig) {
      return NextResponse.json(
        { error: "No Stripe signature found" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err) {
      const error = err as Error;
      console.error("Webhook signature verification failed:", error.message);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    console.log(`Processing webhook event: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(
          event.data.object as ExtendedStripeSubscription
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionCancellation(
          event.data.object as ExtendedStripeSubscription
        );
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSuccess(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailure(event.data.object as Stripe.Invoice);
        break;

      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleSubscriptionChange(
  subscription: ExtendedStripeSubscription
) {
  try {
    const customerId = subscription.customer as string;
    const status = subscription.status;
    const currentPeriodStart = new Date(
      subscription.current_period_start * 1000
    );
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    const cancelAtPeriodEnd = subscription.cancel_at_period_end;

    // Find subscription by customer ID
    const existingSubscription = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!existingSubscription) {
      console.error(`No subscription found for customer ${customerId}`);
      return;
    }

    // Update subscription in database
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        stripeId: subscription.id,
      },
    });

    console.log(
      `Updated subscription ${existingSubscription.id} for customer ${customerId}`
    );
  } catch (error) {
    console.error("Error handling subscription change:", error);
  }
}

async function handleSubscriptionCancellation(
  subscription: ExtendedStripeSubscription
) {
  try {
    const customerId = subscription.customer as string;

    const existingSubscription = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!existingSubscription) {
      console.error(`No subscription found for customer ${customerId}`);
      return;
    }

    // Update to canceled status
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        status: "canceled",
        cancelAtPeriodEnd: false,
      },
    });

    console.log(
      `Canceled subscription ${existingSubscription.id} for customer ${customerId}`
    );
  } catch (error) {
    console.error("Error handling subscription cancellation:", error);
  }
}

async function handlePaymentSuccess(invoice: Stripe.Invoice) {
  try {
    const customerId = invoice.customer as string;

    const subscription = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!subscription) {
      console.error(`No subscription found for customer ${customerId}`);
      return;
    }

    // Payment succeeded - ensure subscription is active
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "active",
      },
    });

    console.log(`Payment succeeded for subscription ${subscription.id}`);
  } catch (error) {
    console.error("Error handling payment success:", error);
  }
}

async function handlePaymentFailure(invoice: Stripe.Invoice) {
  try {
    const customerId = invoice.customer as string;

    const subscription = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!subscription) {
      console.error(`No subscription found for customer ${customerId}`);
      return;
    }

    // Payment failed - update to past_due
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "past_due",
      },
    });

    console.log(`Payment failed for subscription ${subscription.id}`);
  } catch (error) {
    console.error("Error handling payment failure:", error);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    const tenantId = session.client_reference_id;
    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    if (!tenantId || !subscriptionId) {
      console.error("Missing tenantId or subscriptionId in checkout session");
      return;
    }

    if (!stripe) {
      console.error("Stripe not configured");
      return;
    }

    const stripeSubscription = (await stripe.subscriptions.retrieve(
      subscriptionId
    )) as unknown as ExtendedStripeSubscription;

    const priceId = stripeSubscription.items.data[0]?.price.id;
    const planKey = Object.keys(PLANS).find(
      (key) => PLANS[key as keyof typeof PLANS].priceId === priceId
    );
    const plan = await prisma.plan.findUnique({ where: { name: planKey } });

    if (!plan) {
      console.error(`Plan not found for price ID: ${priceId}`);
      return;
    }

    // Upsert subscription
    await prisma.subscription.upsert({
      where: { tenantId },
      update: {
        stripeId: stripeSubscription.id,
        stripeCustomerId: customerId,
        status: stripeSubscription.status,
        currentPeriodStart: new Date(
          stripeSubscription.current_period_start * 1000
        ),
        currentPeriodEnd: new Date(
          stripeSubscription.current_period_end * 1000
        ),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        trialEndsAt: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
        planId: plan.id,
      },
      create: {
        tenantId,
        stripeId: stripeSubscription.id,
        stripeCustomerId: customerId,
        status: stripeSubscription.status,
        currentPeriodStart: new Date(
          stripeSubscription.current_period_start * 1000
        ),
        currentPeriodEnd: new Date(
          stripeSubscription.current_period_end * 1000
        ),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        trialEndsAt: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
        planId: plan.id,
      },
    });

    console.log(`Processed checkout completion for tenant ${tenantId}`);
  } catch (error) {
    console.error("Error handling checkout completion:", error);
  }
}
