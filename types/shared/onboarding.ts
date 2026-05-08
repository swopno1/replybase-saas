import { z } from "zod";

// ─── Conversion Goal Options ─────────────────────────────────────────────────
export const CONVERSION_GOALS = [
  "lead_capture",
  "booking",
  "support",
  "sales",
  "engagement",
] as const;

export const PREFERRED_CTAS = [
  "call",
  "whatsapp",
  "email",
  "form",
  "booking_link",
] as const;

export const BOT_PERSONALITIES = [
  "professional",
  "friendly",
  "casual",
  "luxury",
] as const;

export const ESCALATION_PREFERENCES = [
  "email",
  "phone",
  "live_chat",
  "none",
] as const;

// ─── Schema ──────────────────────────────────────────────────────────────────

export const OnboardingSchema = z.object({
  business: z.object({
    name: z.string().min(1).max(100),
    company: z.string().min(1).max(100),
    industry: z.string().max(100),
    subIndustry: z.string().max(100).optional(),
    website: z.string().max(255).optional(),
    businessModel: z.string().max(100),
  }),
  offer: z.object({
    description: z.string().max(5000),
    targetCustomers: z.array(z.string()),
    mainProducts: z.string().max(5000),
  }),
  chatbotGoals: z.object({
    conversionGoal: z.enum(CONVERSION_GOALS),
    preferredCta: z.enum(PREFERRED_CTAS),
    botPersonality: z.enum(BOT_PERSONALITIES),
    escalationPreference: z.enum(ESCALATION_PREFERENCES),
  }),
  context: z.object({
    commonQuestions: z.string().max(5000),
    otherInfo: z.string().max(5000).optional(),
  }),
});

export type OnboardingData = z.infer<typeof OnboardingSchema>;

export interface OnboardingSummary {
  companyProfile: string;
  targetAudience: string;
  keyOfferings: string;
  commonQueries: string;
  toneAndVoice: string;
  conversionGoal: string;
  preferredCta: string;
  escalationPreference: string;
  isPlaceholder?: boolean;
}

// ─── Legacy schema support (backward compat for existing tenants) ────────────

export const LegacyOnboardingSchema = z.object({
  kyc: z.object({
    name: z.string().min(1).max(100),
    company: z.string().min(1).max(100),
    contactInfo: z.string().max(500),
    location: z.string().max(200),
  }),
  businessBasics: z.object({
    industry: z.string().max(100),
    subIndustry: z.string().max(100).optional(),
    companySize: z.string().max(100),
    website: z.string().max(255).optional(),
    businessModel: z.string().max(100),
  }),
  productDetails: z.object({
    offer: z.string().max(5000),
    targetCustomers: z.array(z.string()),
  }),
  productSpecifics: z.object({
    mainProducts: z.string().max(5000),
    pricing: z.string().max(1000),
    usps: z.string().max(2000),
  }),
  supportSales: z.object({
    commonQuestions: z.string().max(5000),
    painPoints: z.string().max(2000),
    salesProcess: z.string().max(2000),
  }),
  additionalContext: z.object({
    otherInfo: z.string().max(5000).optional(),
  }),
});

export type LegacyOnboardingData = z.infer<typeof LegacyOnboardingSchema>;

/** Convert legacy onboarding data to the new format */
export function migrateLegacyOnboardingData(legacy: LegacyOnboardingData): OnboardingData {
  return {
    business: {
      name: legacy.kyc.name,
      company: legacy.kyc.company,
      industry: legacy.businessBasics.industry,
      subIndustry: legacy.businessBasics.subIndustry,
      website: legacy.businessBasics.website,
      businessModel: legacy.businessBasics.businessModel,
    },
    offer: {
      description: legacy.productDetails.offer,
      targetCustomers: legacy.productDetails.targetCustomers,
      mainProducts: legacy.productSpecifics.mainProducts,
    },
    chatbotGoals: {
      conversionGoal: "lead_capture", // safe default
      preferredCta: "email",
      botPersonality: "professional",
      escalationPreference: "email",
    },
    context: {
      commonQuestions: legacy.supportSales.commonQuestions,
      otherInfo: legacy.additionalContext.otherInfo,
    },
  };
}
