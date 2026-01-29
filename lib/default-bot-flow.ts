import { prisma } from "@/lib/prisma";

/**
 * Default Bot Conversation Flow States
 */
export enum FlowState {
  WELCOME = "welcome",
  ASK_NAME = "ask_name",
  ASK_COMPANY = "ask_company",
  ASK_MOBILE = "ask_mobile",
  ASK_EMAIL = "ask_email",
  ASK_BUSINESS_TYPE = "ask_business_type",
  ASK_SUBSCRIPTION = "ask_subscription",
  SUBSCRIPTION_SELECTED = "subscription_selected",
  COMPLETED = "completed",
}

/**
 * Conversation state stored in CrmConversation.metadata
 */
interface ConversationState {
  flowState: FlowState;
  leadId?: string;
  leadData?: {
    name?: string;
    company?: string;
    mobile?: string;
    email?: string;
    businessType?: string;
    interestedInSubscription?: boolean;
    selectedPlan?: string;
    trialRequested?: boolean;
  };
}

/**
 * Process default bot flow and return response
 */
export async function processDefaultBotFlow(
  conversationId: string,
  contactId: string,
  tenantId: string,
  userMessage: string,
): Promise<string> {
  // Get conversation state
  const conversation = await prisma.crmConversation.findUnique({
    where: { id: conversationId },
    select: { metadata: true },
  });

  const state: ConversationState = conversation?.metadata
    ? (conversation.metadata as unknown as ConversationState)
    : { flowState: FlowState.WELCOME, leadData: {} };

  let response = "";
  let nextState = state.flowState;

  // State machine
  switch (state.flowState) {
    case FlowState.WELCOME:
      response =
        "👋 Welcome to ReplyBase! We're excited to help you manage your customer conversations with AI-powered automation.\n\nLet's get started! What's your name?";
      nextState = FlowState.ASK_NAME;
      break;

    case FlowState.ASK_NAME:
      state.leadData!.name = userMessage.trim();
      response = `Nice to meet you, ${state.leadData!.name}! 😊\n\nWhat's your company or business name?`;
      nextState = FlowState.ASK_COMPANY;
      break;

    case FlowState.ASK_COMPANY:
      state.leadData!.company = userMessage.trim();
      response = `Great! What's the best mobile number to reach you at?`;
      nextState = FlowState.ASK_MOBILE;
      break;

    case FlowState.ASK_MOBILE:
      state.leadData!.mobile = userMessage.trim();
      response = `Perfect! And your email address?`;
      nextState = FlowState.ASK_EMAIL;
      break;

    case FlowState.ASK_EMAIL:
      state.leadData!.email = userMessage.trim();
      response = `Almost done! What type of business are you in?\n\n(e.g., E-commerce, Real Estate, Healthcare, Consulting, etc.)`;
      nextState = FlowState.ASK_BUSINESS_TYPE;
      break;

    case FlowState.ASK_BUSINESS_TYPE:
      state.leadData!.businessType = userMessage.trim();
      response = `Awesome! Thanks for sharing, ${state.leadData!.name}! 🎉\n\nWe offer AI-powered conversation management to help businesses like ${state.leadData!.company} automate customer support.\n\n💎 **Our Plans:**\n\n🆓 **Free** - Perfect to get started\n• 100 AI messages/month\n• 1 bot\n• Basic analytics\n\n🚀 **Starter ($19/month)** - For growing teams\n• 1,000 AI messages/month\n• 5 bots\n• Advanced analytics\n• Priority support\n\n⭐ **Pro ($49/month)** - Most popular\n• 10,000 AI messages/month\n• Unlimited bots\n• Custom integrations\n• API access\n\n💼 **Business ($99/month)** - For enterprises\n• 50,000 AI messages/month\n• Everything in Pro\n• Dedicated support\n• Custom features\n\n🎁 **Special Offer:** Start with a 14-day free trial of any paid plan!\n\nAre you interested in subscribing?\n\nReply:\n• "Yes" - to choose a plan\n• "Trial" - to start 14-day free trial\n• "No" - maybe later`;
      nextState = FlowState.ASK_SUBSCRIPTION;
      break;

    case FlowState.ASK_SUBSCRIPTION:
      const userResponse = userMessage.toLowerCase().trim();

      if (userResponse.includes("yes") || userResponse.includes("interested")) {
        state.leadData!.interestedInSubscription = true;
        response = `Fantastic! 🎊 Which plan works best for you?\n\nReply with:\n• "Free" - Start free forever\n• "Starter" - $19/month\n• "Pro" - $49/month (Recommended ⭐)\n• "Business" - $99/month`;
        nextState = FlowState.SUBSCRIPTION_SELECTED;
      } else if (userResponse.includes("trial")) {
        state.leadData!.interestedInSubscription = true;
        state.leadData!.trialRequested = true;
        response = `Perfect! Which plan would you like to try for 14 days free?\n\nReply with:\n• "Starter" - Try $19/month plan\n• "Pro" - Try $49/month plan (Recommended ⭐)\n• "Business" - Try $99/month plan`;
        nextState = FlowState.SUBSCRIPTION_SELECTED;
      } else {
        state.leadData!.interestedInSubscription = false;
        response = `No problem at all! We've saved your information and you can subscribe anytime at https://app.replybase.co.uk/pricing\n\nFeel free to reach out if you have any questions. Have a great day! 😊`;
        nextState = FlowState.COMPLETED;

        // Create lead as "not interested"
        await createLead(contactId, tenantId, state.leadData!, false);
      }
      break;

    case FlowState.SUBSCRIPTION_SELECTED:
      const planResponse = userMessage.toLowerCase().trim();
      let selectedPlan = "";

      if (planResponse.includes("free")) {
        selectedPlan = "free";
      } else if (planResponse.includes("starter")) {
        selectedPlan = "starter";
      } else if (planResponse.includes("pro")) {
        selectedPlan = "pro";
      } else if (planResponse.includes("business")) {
        selectedPlan = "business";
      } else {
        response = `I didn't quite catch that. Please reply with one of: Free, Starter, Pro, or Business`;
        return response;
      }

      state.leadData!.selectedPlan = selectedPlan;

      // Create lead as qualified
      const lead = await createLead(contactId, tenantId, state.leadData!, true);
      state.leadId = lead.id;

      const planName =
        selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1);
      const trialText = state.leadData!.trialRequested
        ? " with a 14-day free trial"
        : "";

      response = `🎉 Excellent choice! You've selected the **${planName}** plan${trialText}.\n\nThank you for choosing ReplyBase, ${state.leadData!.name}! 🙏\n\nHere's what happens next:\n\n1️⃣ Our team will review your information\n2️⃣ You'll receive a welcome email at ${state.leadData!.email} within 24 hours\n3️⃣ We'll set up your account and bots\n4️⃣ You'll get access to our dashboard at https://app.replybase.co.uk\n\nWe're excited to help ${state.leadData!.company} succeed! 🚀\n\nIf you have any questions, just reply here. We're here to help!`;

      nextState = FlowState.COMPLETED;
      break;

    case FlowState.COMPLETED:
      response = `Hi ${state.leadData!.name}! Thanks for reaching out. Our team will be in touch soon.\n\nIf you have urgent questions, please email support@replybase.co.uk or visit https://app.replybase.co.uk`;
      break;

    default:
      response =
        "I'm having trouble understanding. Let me connect you with our team.";
  }

  // Update conversation state
  const newState: ConversationState = {
    ...state,
    flowState: nextState,
  };

  await prisma.crmConversation.update({
    where: { id: conversationId },
    data: { metadata: newState as unknown },
  });

  return response;
}

interface LeadData {
  name?: string;
  company?: string;
  mobile?: string;
  email?: string;
  businessType?: string;
  interestedInSubscription?: boolean;
  selectedPlan?: string;
  trialRequested?: boolean;
}

/**
 * Create or update lead in database
 */
async function createLead(
  contactId: string,
  tenantId: string,
  leadData: LeadData,
  qualified: boolean,
) {
  // Check if lead already exists for this contact
  const existingLead = await prisma.lead.findFirst({
    where: {
      contactId,
      tenantId,
    },
  });

  const leadRecord = {
    tenantId,
    contactId,
    name: leadData.name,
    company: leadData.company,
    mobile: leadData.mobile,
    email: leadData.email,
    businessType: leadData.businessType,
    interestedInSubscription: leadData.interestedInSubscription || false,
    selectedPlan: leadData.selectedPlan,
    trialRequested: leadData.trialRequested || false,
    status: qualified ? "qualified" : "contacted",
  };

  if (existingLead) {
    return await prisma.lead.update({
      where: { id: existingLead.id },
      data: leadRecord,
    });
  } else {
    return await prisma.lead.create({
      data: leadRecord,
    });
  }
}

/**
 * Check if conversation should use default bot flow
 */
export function shouldUseDefaultFlow(conversation: {
  botId?: string | null;
  metadata?: unknown;
}): boolean {
  // Use default flow if:
  // 1. No bot is assigned, OR
  // 2. Conversation metadata indicates we're in the default flow
  const metadata = conversation?.metadata as ConversationState | null;
  return !conversation?.botId || metadata?.flowState !== undefined;
}
