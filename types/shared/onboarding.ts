import { z } from "zod";

export const OnboardingSchema = z.object({
  kyc: z.object({
    name: z.string().min(1).max(100),
    company: z.string().min(1).max(100),
    contactInfo: z.string().max(200),
    location: z.string().max(100),
  }),
  businessBasics: z.object({
    industry: z.string().max(100),
    subIndustry: z.string().max(100).optional(),
    companySize: z.string().max(50),
    website: z.string().max(255).optional(),
    businessModel: z.string().max(100),
  }),
  productDetails: z.object({
    offer: z.string().max(1000),
    targetCustomers: z.array(z.string()),
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

export type OnboardingData = z.infer<typeof OnboardingSchema>;

export interface OnboardingSummary {
  companyProfile: string;
  targetAudience: string;
  keyOfferings: string;
  pricingStrategy: string;
  competitiveAdvantage: string;
  commonQueries: string;
  toneAndVoice: string;
  isPlaceholder?: boolean;
}
