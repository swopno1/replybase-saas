import { generateText } from "ai";
import { getSystemModel } from "./ai-service";
import { OnboardingData, OnboardingSummary } from "@/types/shared/onboarding";
import { FlowTemplateCategory, getTemplateByCategory } from "./flow-templates";

// ─── Industry → Template Mapping ────────────────────────────────────────────

const INDUSTRY_TO_TEMPLATE: Record<string, FlowTemplateCategory> = {
  // Software & Technology
  "Software & Technology": "saas",
  // E-commerce & Retail
  "E-commerce & Retail": "ecommerce",
  // Marketing & Agency
  "Marketing & Agency": "agencies",
  // Real Estate
  "Real Estate": "real-estate",
  // Professional Services
  "Professional Services": "services",
  // Travel & Hospitality
  "Travel & Hospitality": "hotel",
  // Healthcare & Wellness
  "Healthcare & Wellness": "booking",
  // Home Services & Trades
  "Home Services & Trades": "services",
  // Education & Coaching
  "Education & Coaching": "services",
  // Other
  "Other": "welcome",
};

const SUBINDUSTRY_OVERRIDES: Record<string, FlowTemplateCategory> = {
  // Healthcare sub-types
  "Clinics/Dental": "booking",
  "Fitness/Gyms": "boutique-gym",
  "MedSpas & Salons": "hair-salon",
  "Mental Health": "booking",
  // Home Services sub-types
  "Cleaning": "cleaning-services",
  "Landscaping": "landscaping",
  "Plumbing/HVAC": "handyman",
  "Construction/Remodeling": "handyman",
  // Travel sub-types
  "Hotels/Resorts": "hotel",
  "Restaurants & Cafes": "restaurant",
  "Event Planning": "booking",
  "Tour Operators": "booking",
  // Real Estate sub-types
  "Property Management": "real-estate",
  "Commercial": "real-estate",
  // Software sub-types
  "SaaS": "saas",
  "IT Services": "services",
  "App Development": "agencies",
  // Marketing sub-types
  "Digital Marketing": "agencies",
  "SEO/Content": "agencies",
  "Lead Generation": "lead-generation",
  // E-commerce sub-types
  "Direct to Consumer (D2C)": "ecommerce",
  "B2B Wholesale": "ecommerce",
  "Dropshipping": "ecommerce",
  "Brick & Mortar": "ecommerce",
};

export function resolveTemplateCategory(data: OnboardingData): FlowTemplateCategory {
  // 1. Check sub-industry first (most specific)
  if (data.business.subIndustry && SUBINDUSTRY_OVERRIDES[data.business.subIndustry]) {
    return SUBINDUSTRY_OVERRIDES[data.business.subIndustry];
  }

  // 2. Check main industry
  if (INDUSTRY_TO_TEMPLATE[data.business.industry]) {
    return INDUSTRY_TO_TEMPLATE[data.business.industry];
  }

  // 3. Goal-based fallback
  switch (data.chatbotGoals.conversionGoal) {
    case "booking": return "booking";
    case "lead_capture": return "lead-generation";
    case "sales": return "lead-generation";
    case "support": return "welcome";
    case "engagement": return "welcome";
    default: return "welcome";
  }
}

// ─── Personality → Tone Mapping ─────────────────────────────────────────────

const PERSONALITY_TO_TONE: Record<string, string> = {
  professional: "Professional, clear, and confident. Avoid slang. Use complete sentences.",
  friendly: "Warm, approachable, and conversational. Use emojis sparingly. Be enthusiastic but genuine.",
  casual: "Relaxed and informal. Short sentences. Use emojis freely. Feel like texting a friend.",
  luxury: "Elegant and refined. Speak with authority and exclusivity. Avoid casual language entirely.",
};

// ─── Step 1: Summarize Onboarding Data ──────────────────────────────────────

export async function summarizeOnboardingData(data: OnboardingData): Promise<OnboardingSummary> {
  const model = getSystemModel({ planName: "free", task: "onboarding" });

  const prompt = `You are a business analyst. Summarize the following business data into a structured JSON profile that will configure an AI chatbot.

BUSINESS DATA:
- Company: ${data.business.company}
- Industry: ${data.business.industry}${data.business.subIndustry ? ` (${data.business.subIndustry})` : ""}
- Business Model: ${data.business.businessModel}
- Website: ${data.business.website || "Not provided"}
- Products/Services: ${data.offer.mainProducts}
- What they offer: ${data.offer.description}
- Target customers: ${data.offer.targetCustomers.join(", ")}
- Common customer questions: ${data.context.commonQuestions}
- Chatbot goal: ${data.chatbotGoals.conversionGoal}
- Preferred CTA: ${data.chatbotGoals.preferredCta}
- Bot personality: ${data.chatbotGoals.botPersonality}
${data.context.otherInfo ? `- Additional context: ${data.context.otherInfo}` : ""}

Return ONLY a JSON object with these keys:
- companyProfile: 2-sentence summary of what the company does and its value proposition.
- targetAudience: Who their ideal customer is (1 sentence).
- keyOfferings: Comma-separated list of main products/services.
- commonQueries: Top 5 questions the chatbot should answer, as a numbered list.
- toneAndVoice: One sentence describing the recommended chatbot tone.

Output ONLY valid JSON, no markdown.`;

  try {
    const { text } = await generateText({ model, prompt, 
      // @ts-ignore
      maxTokens: 1000 });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return {
      ...parsed,
      conversionGoal: data.chatbotGoals.conversionGoal,
      preferredCta: data.chatbotGoals.preferredCta,
      escalationPreference: data.chatbotGoals.escalationPreference,
    };
  } catch (err) {
    console.error("Failed to parse AI summary:", err);
    return {
      companyProfile: `${data.business.company} is a ${data.business.industry} business offering ${data.offer.mainProducts}.`,
      targetAudience: data.offer.targetCustomers.join(", "),
      keyOfferings: data.offer.mainProducts,
      commonQueries: data.context.commonQuestions,
      toneAndVoice: PERSONALITY_TO_TONE[data.chatbotGoals.botPersonality] || "Professional and helpful",
      conversionGoal: data.chatbotGoals.conversionGoal,
      preferredCta: data.chatbotGoals.preferredCta,
      escalationPreference: data.chatbotGoals.escalationPreference,
      isPlaceholder: true,
    };
  }
}

// ─── Step 2: Customize Flow Template with AI ────────────────────────────────

export async function customizeFlowNodesWithAI(
  nodes: Array<{ type: string; content: Record<string, unknown>; order: number }>,
  summary: OnboardingSummary,
  data: OnboardingData,
): Promise<Array<{ type: string; content: Record<string, unknown>; order: number }>> {
  if (summary.isPlaceholder) return nodes;

  const model = getSystemModel({ planName: "free", task: "onboarding" });

  const tone = PERSONALITY_TO_TONE[data.chatbotGoals.botPersonality] || summary.toneAndVoice || "Professional and helpful";

  const prompt = `You are an expert conversational designer for chatbot flows.

TASK: Customize the text content of chatbot flow nodes to match a specific business.

RULES:
1. Keep the structure, types, and order of ALL nodes EXACTLY the same.
2. Only modify "text" fields inside "content" objects.
3. Replace any generic placeholders with business-specific language.
4. Match this tone: ${tone}
5. The chatbot's primary goal is: ${data.chatbotGoals.conversionGoal}
6. The preferred CTA is: ${data.chatbotGoals.preferredCta}
7. When the flow ends, set expectation that a human will follow up.
8. DO NOT change, remove, or modify ANY variable placeholders like {{lead_name}} or {{contact_name || lead_name}}. Keep them exactly as they are.

BUSINESS CONTEXT:
- Company: ${data.business.company}
- Industry: ${data.business.industry}
- Products: ${data.offer.mainProducts}
- What they offer: ${data.offer.description}
- Target customers: ${data.offer.targetCustomers.join(", ")}
- Company profile: ${summary.companyProfile}

NODES TO CUSTOMIZE:
${JSON.stringify(nodes, null, 2)}

Return ONLY a valid JSON array of the customized nodes. Same length, same structure.`;

  try {
    const { text } = await generateText({ model, prompt, 
      // @ts-ignore
      maxTokens: 2500 });
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const customizedNodes = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    if (Array.isArray(customizedNodes) && customizedNodes.length === nodes.length) {
      return customizedNodes;
    }
    return nodes;
  } catch (error) {
    console.error("Failed to customize nodes with AI:", error);
    return nodes;
  }
}

// ─── Step 3: Append Lead Generation Nodes ───────────────────────────────────

export function appendLeadGenerationNodes(
  nodes: Array<{ type: string; content: Record<string, unknown>; order: number }>,
  data: OnboardingData,
): Array<{ type: string; content: Record<string, unknown>; order: number }> {
  const lastOrder = nodes.length > 0 ? Math.max(...nodes.map(n => n.order)) : -1;

  // Check if we already have lead capture nodes
  const hasEmailCapture = nodes.some(n =>
    n.type === "input" &&
    (n.content.variableName as string)?.toLowerCase().includes("email")
  );

  if (hasEmailCapture) return nodes;

  // Build CTA-appropriate closing message
  const ctaMessages: Record<string, string> = {
    call: "Our team will give you a call shortly to discuss further. 📞",
    whatsapp: "We'll reach out on WhatsApp to continue the conversation. 💬",
    email: "We'll send you a detailed follow-up to your email. 📧",
    form: "We've captured your details and our team will be in touch. ✅",
    booking_link: "You can book a time that works for you, and we'll confirm right away. 📅",
  };

  const escalationMessages: Record<string, string> = {
    email: "If you need anything urgent, you can also email us directly.",
    phone: "For urgent matters, feel free to call us directly.",
    live_chat: "A team member will be with you shortly in this chat.",
    none: "We'll get back to you as soon as possible.",
  };

  const ctaMsg = ctaMessages[data.chatbotGoals.preferredCta] || ctaMessages.email;
  const escalationMsg = escalationMessages[data.chatbotGoals.escalationPreference] || escalationMessages.none;

  const leadNodes = [
    {
      type: "message",
      content: {
        text: "Great! Let me grab a few details so we can follow up properly. 🚀",
        delayMs: 1000,
        typingEnabled: true,
        typingDurationMs: 1500,
      },
      order: lastOrder + 1,
    },
    {
      type: "input",
      content: {
        text: "What's your name? 😊",
        variableName: "lead_name",
        inputType: "text",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: lastOrder + 2,
    },
    {
      type: "input",
      content: {
        text: "Nice to meet you, {{contact_name || lead_name}}! What's your best email address? 📧",
        variableName: "lead_email",
        inputType: "email",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: lastOrder + 3,
    },
    {
      type: "input",
      content: {
        text: "And a phone number if you'd prefer a quick call? (Optional) 📱",
        variableName: "lead_phone",
        inputType: "phone",
        delayMs: 500,
        typingEnabled: true,
        typingDurationMs: 1000,
      },
      order: lastOrder + 4,
    },
    {
      type: "action",
      content: {
        action: "tag_user",
        tags: [
          `${data.chatbotGoals.conversionGoal}-lead`,
          "automatic-capture",
          `cta-${data.chatbotGoals.preferredCta}`,
        ],
      },
      order: lastOrder + 5,
    },
    {
      type: "action",
      content: {
        action: "update_status",
        status: "qualified",
      },
      order: lastOrder + 6,
    },
    {
      type: "message",
      content: {
        text: `Thanks, {{contact_name || lead_name}}! ${ctaMsg}\n\n${escalationMsg}`,
        delayMs: 800,
        typingEnabled: true,
        typingDurationMs: 1200,
      },
      order: lastOrder + 7,
    },
    {
      type: "action",
      content: { action: "end_flow" },
      order: lastOrder + 8,
    },
  ];

  const rewiredNodes = nodes.map(n => {
    if (n.type === "action" && (n.content as any).action === "end_flow") {
      return {
        ...n,
        content: {
          action: "tag_user",
          tags: ["entering-lead-gen"],
          nextNodeOrder: lastOrder + 1,
        }
      };
    }
    return n;
  });

  return [...rewiredNodes, ...leadNodes];
}

// ─── AI Fallback System Prompt Builder ──────────────────────────────────────

/**
 * Builds a grounded system prompt for the AI fallback from bot context.
 * Used by ai-fallback.ts for ALL plan tiers.
 */
export function buildFallbackSystemPrompt(
  botContext: OnboardingSummary | Record<string, unknown> | null,
  botName?: string,
): string {
  if (!botContext) {
    return `You are a helpful assistant${botName ? ` for ${botName}` : ""}. Keep responses short and helpful. If you're unsure about anything, say "I'll have our team get back to you on that." Never make up information.`;
  }

  const ctx = botContext as Partial<OnboardingSummary>;
  const company = ctx.companyProfile || "this business";
  const offerings = ctx.keyOfferings || "our products and services";
  const queries = ctx.commonQueries || "";
  const tone = ctx.toneAndVoice || "Professional and helpful";
  const escalation = ctx.escalationPreference || "none";

  const escalationLine = escalation === "none"
    ? "If you can't answer, say \"I'll have our team look into this and get back to you.\""
    : escalation === "live_chat"
      ? "If you can't answer, say \"Let me connect you with a team member who can help.\""
      : escalation === "phone"
        ? "If you can't answer, say \"I'd recommend speaking with our team directly — they can help you right away.\""
        : "If you can't answer, say \"I'll have our team follow up with you by email shortly.\"";

  return `You are an AI assistant for ${company}.
You help customers with questions about ${offerings}.

TONE: ${tone}

RULES:
- Keep responses under 3 sentences maximum
- Be helpful but concise
- NEVER make up prices, availability, policies, or commitments
- NEVER promise specific timelines unless explicitly stated in your knowledge
- ${escalationLine}
${queries ? `\nCOMMON QUESTIONS YOU CAN ANSWER:\n${queries}` : ""}
- For anything outside your knowledge, politely redirect to the team`;
}
