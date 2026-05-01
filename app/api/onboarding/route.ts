import { summarizeOnboardingData, customizeFlowNodesWithAI, appendLeadGenerationNodes } from "@/lib/onboarding-ai";
import { getTemplateByCategory, FlowTemplateCategory } from "@/lib/flow-templates";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { OnboardingSchema, OnboardingData, OnboardingSummary } from "@/types/shared/onboarding";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/api-response";
import { Prisma } from "@prisma/client";

// Schema is now in types/shared/onboarding.ts

export const GET = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      isOnboarded: true,
      onboardingStep: true,
      onboardingData: true,
    },
  });

  return successResponse(tenant);
});

export const PATCH = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const body = await request.json();
    const { step, data } = body;

    const currentTenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { onboardingData: true },
    });

    const currentData = (currentTenant?.onboardingData as Record<string, unknown>) || {};
    const newData = { ...currentData, ...data };

    await db.tenant.update({
      where: { id: tenantId },
      data: {
        onboardingStep: step,
        onboardingData: newData as Prisma.InputJsonValue,
      },
    });

    return successResponse({ success: true });
  } catch (error) {
    console.error("[Onboarding PATCH] Error:", error);
    return errorResponse("Failed to update onboarding progress");
  }
});

export const POST = withAuthAndTenant(async ({ id, tenantId }, request, context, db) => {
  try {
    const body = await request.json();
    const validatedData = OnboardingSchema.parse(body);

    let summary: OnboardingSummary;
    try {
      summary = await summarizeOnboardingData(validatedData);
    } catch (err) {
      console.error("[Onboarding AI] Failed to summarize data", err);
      summary = {
        companyProfile: `${validatedData.kyc.company} is a business in the ${validatedData.businessBasics.industry} industry.`,
        targetAudience: Array.isArray(validatedData.productDetails.targetCustomers)
          ? validatedData.productDetails.targetCustomers.join(", ")
          : validatedData.productDetails.targetCustomers,
        keyOfferings: validatedData.productSpecifics.mainProducts,
        pricingStrategy: validatedData.productSpecifics.pricing,
        competitiveAdvantage: validatedData.productSpecifics.usps,
        commonQueries: "Refer to support documents.",
        toneAndVoice: "Professional and helpful",
        isPlaceholder: true
      };
    }

    const mapIndustryToCategory = (industry: string): FlowTemplateCategory => {
      const lower = industry.toLowerCase();
      if (lower.includes("saas")) return "saas";
      if (lower.includes("e-commerce") || lower.includes("retail")) return "ecommerce";
      if (lower.includes("agency")) return "agencies";
      if (lower.includes("real estate")) return "real-estate";
      if (lower.includes("fitness") || lower.includes("gym")) return "boutique-gym";
      if (lower.includes("beauty") || lower.includes("salon")) return "hair-salon";
      if (lower.includes("restaurant") || lower.includes("food")) return "restaurant";
      if (lower.includes("hotel") || lower.includes("hospitality")) return "hotel";
      if (lower.includes("service")) return "services";
      return "welcome";
    };

    const category = mapIndustryToCategory(validatedData.businessBasics.industry);
    const template = getTemplateByCategory(category) || getTemplateByCategory("welcome")!;

    const customizedNodesRaw = await customizeFlowNodesWithAI(template.nodes, summary);
    const customizedNodes = appendLeadGenerationNodes(customizedNodesRaw);

    const flow = await db.flow.create({
      data: {
        name: `${validatedData.kyc.company} Main Flow`,
        description: `Automated flow generated during onboarding from ${template.name} template`,
        tenantId,
        ownerId: id,
        isGlobal: false,
        isActive: true,
        version: 1,
        language: "en",
        fallbackMessage: summary.isPlaceholder ? "Sorry, I didn't understand that." : `I'm not quite sure about that. Our ${validatedData.businessBasics.industry} team will get back to you soon.`,
        maxTimeout: 300,
        nodes: {
          create: customizedNodes.map(
            (node) =>
              ({
                type: node.type,
                content: node.content as Prisma.InputJsonValue,
                order: node.order,
              }) as Prisma.FlowNodeCreateWithoutFlowInput,
          ),
        },
      },
    });

    await db.tenant.update({
      where: { id: tenantId },
      data: {
        isOnboarded: true,
        onboardingData: {
          raw: validatedData,
          summary: summary,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    const botCount = await db.bot.count({ where: { tenantId } });
    if (botCount === 0) {
      await db.bot.create({
        data: {
          name: `${validatedData.kyc.company} AI Assistant`,
          tenantId,
          enabled: true,
          context: summary as unknown as Prisma.InputJsonValue,
          entryFlow: flow.id,
        },
      });
    } else {
      await db.bot.updateMany({
        where: { tenantId },
        data: {
          context: summary as unknown as Prisma.InputJsonValue,
          entryFlow: flow.id,
        },
      });
    }

    return successResponse({ success: true, summary, flowId: flow.id });
  } catch (error) {
    if (error instanceof Error && "name" in error && error.name === "ZodError") {
       return validationErrorResponse(error as any);
    }
    console.error("[Onboarding POST] Error:", error);
    return errorResponse("Failed to complete onboarding");
  }
});
