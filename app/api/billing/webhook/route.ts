import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Extend Stripe types to include the properties we need
interface ExtendedStripeSubscription extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

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

    // Wrap event processing in a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Check for idempotency
      const existingEvent = await tx.stripeEvent.findUnique({
        where: { id: event.id },
      });

      if (existingEvent) {
        console.log(`Event ${event.id} already processed.`);
        return;
      }

      // Record the event to prevent reprocessing
      await tx.stripeEvent.create({
        data: { id: event.id },
      });

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
    });

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
    const { id: stripeId, status, customer: customerId } = subscription;
    const currentPeriodStart = new Date(
      subscription.current_period_start * 1000
    );
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    const cancelAtPeriodEnd = subscription.cancel_at_period_end;

    // Find subscription by the unique Stripe subscription ID
    const existingSubscription = await prisma.subscription.findUnique({
      where: { stripeId },
    });

    if (!existingSubscription) {
      console.error(`No subscription found for Stripe ID ${stripeId}`);
      return;
    }

    // Update subscription in database
    await prisma.subscription.update({
      where: { stripeId },
      data: {
        status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
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
    const { id: stripeId, customer: customerId } = subscription;

    const existingSubscription = await prisma.subscription.findUnique({
      where: { stripeId },
    });

    if (!existingSubscription) {
      console.error(`No subscription found for Stripe ID ${stripeId}`);
      return;
    }

    // Update to canceled status
    await prisma.subscription.update({
      where: { stripeId },
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
    const stripeId = invoice.subscription as string;
    if (!stripeId) return;

    const subscription = await prisma.subscription.findUnique({
      where: { stripeId },
    });

    if (!subscription) {
      console.error(`No subscription found for Stripe ID ${stripeId}`);
      return;
    }

    // Payment succeeded - ensure subscription is active
    await prisma.subscription.update({
      where: { stripeId },
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
    const stripeId = invoice.subscription as string;
    if (!stripeId) return;

    const subscription = await prisma.subscription.findUnique({
      where: { stripeId },
    });

    if (!subscription) {
      console.error(`No subscription found for Stripe ID ${stripeId}`);
      return;
    }

    // Payment failed - update to past_due
    await prisma.subscription.update({
      where: { stripeId },
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
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!customerId || !subscriptionId) {
      console.log("Checkout session missing customer or subscription ID");
      return;
    }

    // Get subscription details from Stripe
    if (!stripe) {
      console.error("Stripe not configured");
      return;
    }
    const stripeSubscription = (await stripe.subscriptions.retrieve(
      subscriptionId
    )) as unknown as ExtendedStripeSubscription;

    // Find subscription in database
    const existingSubscription = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (existingSubscription) {
      // Update existing subscription
      await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          stripeId: stripeSubscription.id,
          status: stripeSubscription.status,
          currentPeriodStart: new Date(
            stripeSubscription.current_period_start * 1000
          ),
          currentPeriodEnd: new Date(
            stripeSubscription.current_period_end * 1000
          ),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        },
      });
    }

    console.log(`Processed checkout completion for customer ${customerId}`);
  } catch (error) {
    console.error("Error handling checkout completion:", error);
  }
}
