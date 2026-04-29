import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { summarizeOnboardingData, customizeFlowNodesWithAI } from "@/lib/onboarding-ai";
import { getTemplateByCategory, FlowTemplateCategory } from "@/lib/flow-templates";

const onboardingSchema = z.object({
  kyc: z.object({
    name: z.string().min(1).max(100),
    company: z.string().min(1).max(100),
    contactInfo: z.string().max(200),
    location: z.string().max(100),
  }),
  businessBasics: z.object({
    industry: z.string().max(100),
    companySize: z.string().max(50),
    website: z.string().max(255).optional(),
    businessModel: z.string().max(100),
  }),
  productDetails: z.object({
    offer: z.string().max(1000),
    targetCustomers: z.union([z.string(), z.array(z.string())]),
  }),
  productSpecifics: z.object({
    mainProducts: z.string().max(1000),
    pricing: z.string().max(500),
    usps: z.string().max(1000),
  }),
  supportSales: z.object({
    commonQuestions: z.string().max(2000),
    painPoints: z.string().max(1000),
    salesProcess: z.string().max(1000),
  }),
  additionalContext: z.object({
    otherInfo: z.string().max(2000).optional(),
  }),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: {
      isOnboarded: true,
      onboardingStep: true,
      onboardingData: true,
    },
  });

  return NextResponse.json(tenant);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { step, data } = body;

    // Partial update of onboarding data
    const currentTenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { onboardingData: true },
    });

    const currentData = (currentTenant?.onboardingData as Record<string, unknown>) || {};
    const newData = { ...currentData, ...data };

    await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        onboardingStep: step,
        onboardingData: newData,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Onboarding PATCH] Error:", error);
    return NextResponse.json({ error: "Failed to update onboarding progress" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validatedData = onboardingSchema.parse(body);

    let summary;
    try {
      summary = await summarizeOnboardingData(validatedData as unknown as Parameters<typeof summarizeOnboardingData>[0]);
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

    // Map industry to flow category
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
      return "welcome"; // Fallback to a universal template
    };

    const category = mapIndustryToCategory(validatedData.businessBasics.industry);
    const template = getTemplateByCategory(category) || getTemplateByCategory("welcome")!;

    const customizedNodes = await customizeFlowNodesWithAI(template.nodes, summary);

    // Create flow from template
    const flow = await prisma.flow.create({
      data: {
        name: `${validatedData.kyc.company} Main Flow`,
        description: `Automated flow generated during onboarding from ${template.name} template`,
        tenantId: session.user.tenantId,
        ownerId: session.user.id,
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

    await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        isOnboarded: true,
        onboardingData: {
          raw: validatedData,
          summary: summary,
        },
      },
    });

    // Update all bots for this tenant with the new summary context
    await prisma.bot.updateMany({
      where: { tenantId: session.user.tenantId },
      data: {
        context: summary as Prisma.InputJsonValue,
        entryFlow: flow.id,
      },
    });

    return NextResponse.json({ success: true, summary, flowId: flow.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
    }
    console.error("[Onboarding POST] Error:", error);
    return NextResponse.json({ error: "Failed to complete onboarding" }, { status: 500 });
  }
}
