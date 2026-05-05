import {
  summarizeOnboardingData,
  customizeFlowNodesWithAI,
  appendLeadGenerationNodes,
  resolveTemplateCategory,
} from "@/lib/onboarding-ai";
import { getTemplateByCategory } from "@/lib/flow-templates";
import { withAuthAndTenant } from "@/lib/route-helpers";
import { OnboardingSchema, OnboardingData, OnboardingSummary } from "@/types/shared/onboarding";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/api-response";
import { Prisma } from "@prisma/client";

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

    // 1. Summarize onboarding data into structured profile
    let summary: OnboardingSummary;
    try {
      summary = await summarizeOnboardingData(validatedData);
    } catch (err) {
      console.error("[Onboarding AI] Failed to summarize data", err);
      summary = {
        companyProfile: `${validatedData.business.company} is a business in the ${validatedData.business.industry} industry.`,
        targetAudience: Array.isArray(validatedData.offer.targetCustomers)
          ? validatedData.offer.targetCustomers.join(", ")
          : validatedData.offer.targetCustomers,
        keyOfferings: validatedData.offer.mainProducts,
        commonQueries: validatedData.context.commonQuestions,
        toneAndVoice: "Professional and helpful",
        conversionGoal: validatedData.chatbotGoals.conversionGoal,
        preferredCta: validatedData.chatbotGoals.preferredCta,
        escalationPreference: validatedData.chatbotGoals.escalationPreference,
        isPlaceholder: true,
      };
    }

    // 2. Resolve template from industry + sub-industry + goal
    const category = resolveTemplateCategory(validatedData);
    const template = getTemplateByCategory(category) || getTemplateByCategory("welcome")!;

    // 3. Customize template nodes with AI (text only, structure preserved)
    const customizedNodesRaw = await customizeFlowNodesWithAI(
      template.nodes,
      summary,
      validatedData,
    );

    // 4. Append lead generation / CTA nodes based on chatbot goals
    const customizedNodes = appendLeadGenerationNodes(customizedNodesRaw, validatedData);

    // 5. Build fallback message based on escalation preference
    const fallbackMessages: Record<string, string> = {
      email: `I'm not sure about that one. Our ${validatedData.business.industry} team will follow up with you by email shortly.`,
      phone: `That's a great question! Let me have someone from our team call you to discuss.`,
      live_chat: `I'll connect you with a team member who can help with that right away.`,
      none: `I'm not quite sure about that. Our team will get back to you soon.`,
    };

    const fallbackMessage = summary.isPlaceholder
      ? "Sorry, I didn't understand that."
      : fallbackMessages[validatedData.chatbotGoals.escalationPreference] || fallbackMessages.none;

    // 6. Create the flow
    const flow = await db.flow.create({
      data: {
        name: `${validatedData.business.company} Main Flow`,
        description: `Automated flow generated during onboarding from ${template.name} template (${category})`,
        tenantId,
        ownerId: id,
        isGlobal: false,
        isActive: true,
        version: 1,
        language: "en",
        fallbackMessage,
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

    // 7. Store onboarding data and summary
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

    // 8. Create or update bot with context
    const botCount = await db.bot.count({ where: { tenantId } });
    if (botCount === 0) {
      await db.bot.create({
        data: {
          name: `${validatedData.business.company} AI Assistant`,
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
       console.error("[Onboarding POST] Validation Failed:", (error as any).issues);
       return validationErrorResponse(error as any);
    }
    console.error("[Onboarding POST] Error:", error);
    return errorResponse("Failed to complete onboarding");
  }
});
