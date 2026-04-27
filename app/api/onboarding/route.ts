import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { summarizeOnboardingData } from "@/lib/onboarding-ai";

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
    targetCustomers: z.string().max(1000),
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

    const currentData = (currentTenant?.onboardingData as any) || {};
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

    // AI Summarization
    const summary = await summarizeOnboardingData(validatedData);

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

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.errors }, { status: 400 });
    }
    console.error("[Onboarding POST] Error:", error);
    return NextResponse.json({ error: "Failed to complete onboarding" }, { status: 500 });
  }
}
