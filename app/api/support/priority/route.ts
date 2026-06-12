import { NextRequest, NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { sendEmail } from "@/lib/email";
import { isPriorityPlusPlan } from "@/lib/plans";
import { z } from "zod";

const schema = z.object({
  subject: z.string().min(5).max(200),
  message: z.string().min(20).max(5000),
  urgency: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export const POST = withAuthAndTenant(async (user, request, _context, db) => {
  const subscription = await db.subscription.findFirst({
    include: { plan: true },
  });

  if (!subscription || !isPriorityPlusPlan(subscription.plan.name)) {
    return NextResponse.json(
      {
        error: "Priority support is available on the Business plan only.",
        code: "PLAN_GATE_FAILED",
      },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { subject, message, urgency } = parsed.data;

  const tenant = await db.tenant.findFirst({ select: { name: true } });
  const adminEmail =
    process.env.INITIAL_ADMIN_EMAIL || "admin@replybase.co.uk";

  await sendEmail({
    to: adminEmail,
    subject: `[Priority+ Support] [${urgency.toUpperCase()}] ${subject}`,
    text: `
Priority+ Support Ticket
------------------------
Tenant:   ${tenant?.name ?? "N/A"} (${user.tenantId})
User:     ${user.email ?? "N/A"} (${user.id})
Urgency:  ${urgency.toUpperCase()}
Subject:  ${subject}

Message:
${message}

SLA commitment: 4h response target
    `.trim(),
  });

  return NextResponse.json({ success: true });
});
