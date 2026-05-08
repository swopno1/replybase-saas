import { generateObject } from "ai";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { getAiModel } from "@/lib/ai-service";
import logger from "@/lib/logger";

const leadInsightSchema = z.object({
  score: z.number().min(1).max(10).describe("A lead quality score from 1 to 10 based on intent and clarity."),
  urgency: z.enum(["low", "medium", "high"]).describe("The perceived urgency of the inquiry."),
  category: z.string().describe("The primary category of the inquiry (e.g., Sales, Support, Pricing, Partnership)."),
  needs: z.array(z.string()).describe("A list of specific needs or requirements extracted from the inquiry."),
  summary: z.string().describe("A brief 1-sentence summary of the inquiry."),
});

export type LeadInsights = z.infer<typeof leadInsightSchema>;

export class LeadEnrichmentService {
  constructor(private db: PrismaClient) {}

  async enrichLead(leadId: string) {
    try {
      const lead = await this.db.lead.findUnique({
        where: { id: leadId },
        include: { tenant: true },
      });

      if (!lead || !lead.metadata) {
        return null;
      }

      const metadata = lead.metadata as any;
      const enquiry = metadata.enquiry || "";

      if (!enquiry) {
        return null;
      }

      // Get appropriate AI model
      const model = getAiModel({
        provider: (lead.tenant.aiProvider as any) || "default",
        apiKey: lead.tenant.aiApiKey || undefined,
        model: lead.tenant.aiModel || undefined,
        task: "general",
      });

      const { object: insights } = await generateObject({
        model,
        schema: leadInsightSchema,
        prompt: `Analyze the following lead inquiry and extract structured insights:

        Inquiry: "${enquiry}"

        Additional Context:
        Source: ${lead.source}
        Name: ${lead.name || "Unknown"}
        Company: ${lead.company || "Unknown"}
        `,
      });

      // Update lead with insights
      await this.db.lead.update({
        where: { id: leadId },
        data: {
          insights: insights as any,
        },
      });

      return insights;
    } catch (error) {
      logger.error({ error, leadId }, "[LeadEnrichmentService] Failed to enrich lead");
      return null;
    }
  }
}
