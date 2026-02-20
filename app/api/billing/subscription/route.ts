import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    // Get subscription by tenantId
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      // Ensure a free plan exists
      const freePlan = await prisma.plan.upsert({
        where: { name: "free" },
        update: {},
        create: {
          name: "free",
          displayName: "Free",
          price: 0,
          currency: "GBP",
        },
      });

      const now = Date.now();
      const trialEndsAt = new Date(now + 14 * 24 * 60 * 60 * 1000); // 14 days
      const currentPeriodEnd = new Date(now + 30 * 24 * 60 * 60 * 1000); // 30 days

      const created = await prisma.subscription.upsert({
        where: { tenantId: user.tenantId },
        update: {},
        create: {
          tenantId: user.tenantId,
          planId: freePlan.id,
          stripeId: `free_${user.tenantId}`,
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd,
          trialEndsAt,
        },
        include: { plan: true },
      });

      const trialDaysRemaining = Math.max(
        0,
        Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      );

      return NextResponse.json({
        subscription: {
          ...created,
          trialDaysRemaining,
        },
        invoices: [],
      });
    }

    let invoices: Array<{
      id: string;
      invoiceNumber: string;
      amount: number;
      status: string;
      paidAt: string | null;
      dueDate: string;
      downloadUrl?: string;
    }> = [];

    if (stripe && subscription.stripeCustomerId) {
      const stripeInvoices = await stripe.invoices.list({
        customer: subscription.stripeCustomerId,
        limit: 10,
      });

      invoices = stripeInvoices.data.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.number || invoice.id,
        amount: invoice.amount_due,
        status: invoice.status || "unknown",
        paidAt: invoice.status_transitions.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
          : null,
        dueDate: invoice.due_date
          ? new Date(invoice.due_date * 1000).toISOString()
          : new Date(invoice.created * 1000).toISOString(),
        downloadUrl: invoice.invoice_pdf || undefined,
      }));
    }

    const trialDaysRemaining = subscription.trialEndsAt
      ? Math.ceil(
          (subscription.trialEndsAt.getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    return NextResponse.json({
      subscription: {
        ...subscription,
        trialDaysRemaining: Math.max(0, trialDaysRemaining),
      },
      invoices,
    });
  } catch (error) {
    console.error("Subscription fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 },
    );
  }
}
