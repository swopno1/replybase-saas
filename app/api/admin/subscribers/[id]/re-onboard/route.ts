import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/route-helpers";
import { summarizeOnboardingData } from "@/lib/onboarding-ai";
import { OnboardingSchema, OnboardingSummary } from "@/types/shared/onboarding";
import { logAdminActivity } from "@/lib/admin-audit";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export const POST = withAdmin(async (session, request, context, db) => {
  try {
    const { id: subscriberId } = (await context.params) as { id: string };
    const body = await request.json();
    const validatedData = OnboardingSchema.parse(body);

    // 1. Find the subscription and tenant
    const subscription = await db.subscription.findUnique({
      where: { id: subscriberId },
      include: { tenant: true }
    });

    let tenantId = "";
    if (!subscription) {
        // Check if it's a no-sub- tenant
        if (subscriberId.startsWith("no-sub-")) {
            tenantId = subscriberId.replace("no-sub-", "");
        } else {
            return NextResponse.json({ error: "Subscriber/Tenant not found" }, { status: 404 });
        }
    } else {
        tenantId = subscription.tenantId;
    }

    // 2. Re-summarize onboarding data into structured profile
    let summary: OnboardingSummary;
    try {
      summary = await summarizeOnboardingData(validatedData);
    } catch (err) {
      console.error("[Admin Re-onboarding AI] Failed to summarize data", err);
      return NextResponse.json({ error: "AI Summarization failed" }, { status: 500 });
    }

    // 3. Update tenant with new raw data and summary
    await db.tenant.update({
      where: { id: tenantId },
      data: {
        onboardingData: {
          raw: validatedData,
          summary: summary,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // 4. Update all bots for this tenant with the new context
    await db.bot.updateMany({
      where: { tenantId },
      data: {
        context: summary as unknown as Prisma.InputJsonValue,
      },
    });

    // 5. Audit Log
    await logAdminActivity({
      adminId: session.user.id,
      action: "TENANT_REONBOARDED",
      entityType: "TENANT",
      entityId: tenantId,
      description: `Admin re-onboarded tenant ${tenantId} to refresh AI context.`,
      metadata: {
        subscriberId,
        tenantId,
        onboardingData: validatedData,
        summary
      },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
        success: true,
        summary,
        onboardingData: {
            raw: validatedData,
            summary
        }
    });
  } catch (error) {
    console.error("[Admin API] Error re-onboarding subscriber:", error);
    if (error instanceof ZodError) {
        return NextResponse.json({ error: "Invalid onboarding data", details: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to re-onboard subscriber" },
      { status: 500 },
    );
  }
});
