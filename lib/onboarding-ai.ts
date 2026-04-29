import { generateText } from "ai";
import { getAiModel } from "./ai-service";

export interface OnboardingData {
  kyc: {
    name: string;
    company: string;
    contactInfo: string;
    location: string;
  };
  businessBasics: {
    industry: string;
    companySize: string;
    website: string;
    businessModel: string;
  };
  productDetails: {
    offer: string;
    targetCustomers: string;
  };
  productSpecifics: {
    mainProducts: string;
    pricing: string;
    usps: string;
  };
  supportSales: {
    commonQuestions: string;
    painPoints: string;
    salesProcess: string;
  };
  additionalContext: {
    otherInfo: string;
  };
}

/**
 * Summarizes the collected onboarding data into a structured format for the AI assistant.
 */
export async function summarizeOnboardingData(data: OnboardingData) {
  const model = getAiModel({ provider: "default", planName: "pro" });

  const prompt = `
    You are an expert business analyst and AI configuration specialist.
    I will provide you with data collected during a new user onboarding process for a SaaS platform called ReplyBase, which provides AI-powered chatbots for lead capture and customer support.

    Your task is to summarize this data into a clear, structured JSON profile that will be used to initialize and ground the user's custom chatbot.

    Onboarding Data:
    - KYC: Name: ${data.kyc.name}, Company: ${data.kyc.company}, Contact: ${data.kyc.contactInfo}, Location: ${data.kyc.location}
    - Business Basics: Industry: ${data.businessBasics.industry}, Size: ${data.businessBasics.companySize}, Website: ${data.businessBasics.website}, Model: ${data.businessBasics.businessModel}
    - Product/Service: Offer: ${data.productDetails.offer}, Target Customers: ${data.productDetails.targetCustomers}
    - Specifics: Products: ${data.productSpecifics.mainProducts}, Pricing: ${data.productSpecifics.pricing}, USPs: ${data.productSpecifics.usps}
    - Support & Sales: Common Questions: ${data.supportSales.commonQuestions}, Pain Points: ${data.supportSales.painPoints}, Sales Process: ${data.supportSales.salesProcess}
    - Additional Context: ${data.additionalContext.otherInfo}

    Please produce a JSON object with the following keys:
    - companyProfile: A 2-3 sentence summary of what the company does and its value proposition.
    - targetAudience: Description of the ideal customer.
    - keyOfferings: List of main products/services.
    - pricingStrategy: Summary of how they price.
    - competitiveAdvantage: Their USPs.
    - commonQueries: Top 5 questions the chatbot should be prepared to answer.
    - toneAndVoice: Recommended tone for the chatbot based on the business type and industry.

    Output ONLY the JSON object.
  `;

  const { text } = await generateText({
    model,
    prompt,
  });

  try {
    // Attempt to parse JSON from the response. Sometimes models wrap it in markdown.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : text;
    return JSON.parse(jsonString);
  } catch (err) {
    console.error("Failed to parse AI summary:", err, text);
    // Fallback to a basic structure if AI fails
    return {
      companyProfile: `${data.kyc.company} is in the ${data.businessBasics.industry} industry.`,
      raw: data,
    };
  }
}

/**
 * Customizes flow template nodes using AI based on the onboarding summary.
 */
export async function customizeFlowNodesWithAI(
  nodes: Array<{ type: string; content: Record<string, unknown>; order: number }>,
  summary: Record<string, unknown>
): Promise<Array<{ type: string; content: Record<string, unknown>; order: number }>> {
  if (summary.isPlaceholder) return nodes;

  const model = getAiModel({ provider: "default", planName: "pro" });

  const prompt = `
    You are an expert conversational designer. I have a standard chatbot flow template for a new business.
    Your task is to customize the text of the message and input nodes to better fit the specific business based on their summary.
    Keep the structure of the nodes exactly the same, only modify the 'text' fields inside 'content' where appropriate.
    Make the tone match: ${summary.toneAndVoice || "Professional and helpful"}.
    Ensure placeholders like [COMPANY NAME] are replaced with actual names, and general greetings are tailored to their offerings: ${summary.keyOfferings}.

    Company Profile: ${summary.companyProfile}

    Here are the current nodes in JSON format:
    ${JSON.stringify(nodes, null, 2)}

    Return ONLY a JSON array containing the customized nodes. Ensure the output is valid JSON.
  `;

  try {
    const { text } = await generateText({
      model,
      prompt,
    });

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const jsonString = jsonMatch ? jsonMatch[0] : text;
    const customizedNodes = JSON.parse(jsonString);

    // Ensure the structure is roughly correct
    if (Array.isArray(customizedNodes) && customizedNodes.length === nodes.length) {
      return customizedNodes;
    }

    return nodes;
  } catch (error) {
    console.error("Failed to customize nodes with AI:", error);
    return nodes; // Fallback to original nodes
  }
}
