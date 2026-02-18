import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  OnboardingStage,
  OnboardingStatus,
  EmailFrequency,
} from "@prisma/client";

export interface OnboardingMessage {
  text: string;
  quickReplies?: QuickReply[];
  cards?: OnboardingCard[];
  delay?: number; // in milliseconds
}

export interface QuickReply {
  title: string;
  payload: string;
}

export interface OnboardingCard {
  title: string;
  description?: string;
  image_url?: string;
  buttons?: CardButton[];
}

export interface CardButton {
  title: string;
  type: "postback" | "web_url";
  payload?: string;
  url?: string;
}

export class OnboardingService {
  /**
   * Get or create an onboarding session
   */
  static async getOrCreateSession(
    facebookPageId: string,
    conversationId: string,
    contactId: string,
  ) {
    let session = await prisma.onboardingSession.findFirst({
      where: {
        facebookPageId,
        conversationId,
        status: OnboardingStatus.IN_PROGRESS,
      },
    });

    if (!session) {
      session = await prisma.onboardingSession.create({
        data: {
          facebookPageId,
          conversationId,
          contactId,
          stage: OnboardingStage.WELCOME,
          status: OnboardingStatus.IN_PROGRESS,
        },
      });
    }

    return session;
  }

  /**
   * Seed initial demo templates if none exist
   */
  static async seedDemoTemplates() {
    const count = await prisma.demoTemplate.count();
    if (count > 0) return;

    const templates = [
      {
        name: "demo_catalog",
        displayName: "Product Catalog assistant",
        description: "Help customers find products and answer common questions.",
        businessType: "ecommerce",
        icon: "🛍️",
        flowJson: {
          nodes: [
            {
              type: "message",
              content: { text: "Hi! How can I help you today?" },
            },
            {
              type: "input",
              content: {
                placeholder: "Search products...",
                variable: "search_query",
              },
            },
          ],
        },
      },
      {
        name: "demo_booking",
        displayName: "Service Booking Bot",
        description: "Allow clients to book appointments and check availability.",
        businessType: "service",
        icon: "📅",
        flowJson: {
          nodes: [
            {
              type: "message",
              content: { text: "Welcome! Would you like to book an appointment?" },
            },
          ],
        },
      },
      {
        name: "demo_lead_gen",
        displayName: "Lead Generation assistant",
        description: "Qualify new leads and collect their contact information.",
        businessType: "saas",
        icon: "🚀",
        flowJson: {
          nodes: [
            {
              type: "message",
              content: { text: "Tell us about your business needs!" },
            },
          ],
        },
      },
      {
        name: "demo_support",
        displayName: "Customer Support bot",
        description: "Answer frequently asked questions and provide support.",
        businessType: "other",
        icon: "🤝",
        flowJson: {
          nodes: [
            {
              type: "message",
              content: { text: "How can we help you today?" },
            },
          ],
        },
      },
    ];

    for (const template of templates) {
      await prisma.demoTemplate.create({
        data: template,
      });
    }
  }

  /**
   * Get the next message based on current stage
   */
  static getStageMessage(stage: OnboardingStage): OnboardingMessage {
    const messages: Record<OnboardingStage, OnboardingMessage> = {
      [OnboardingStage.WELCOME]: {
        text: "🎉 Welcome to ReplyBase!\n\nWe're excited to help you automate your customer conversations on Facebook Messenger. Let's get you set up in just a few minutes!\n\nClick the button below to get started.",
        quickReplies: [
          {
            title: "Get Started",
            payload: "get_started",
          },
        ],
      },

      [OnboardingStage.COLLECT_INFO]: {
        text: "Great! Let's start with the basics. What's your name?",
      },

      [OnboardingStage.BUSINESS_TYPE]: {
        text: "Perfect! Now, what type of business are you in?",
        quickReplies: [
          {
            title: "🛍️ E-commerce",
            payload: "business_ecommerce",
          },
          {
            title: "💼 Service",
            payload: "business_service",
          },
          {
            title: "🚀 SaaS",
            payload: "business_saas",
          },
          {
            title: "🤝 Agency",
            payload: "business_agency",
          },
          {
            title: "📊 Other",
            payload: "business_other",
          },
        ],
      },

      [OnboardingStage.CONTACT_INFO]: {
        text: "Could you share your business email and phone number so we can reach out with next steps?",
      },

      [OnboardingStage.EMAIL_PREFERENCE]: {
        text: "How often would you like to receive updates from us?",
        quickReplies: [
          {
            title: "📅 Daily",
            payload: "email_daily",
          },
          {
            title: "📆 Weekly",
            payload: "email_weekly",
          },
          {
            title: "📋 Monthly",
            payload: "email_monthly",
          },
          {
            title: "🔕 Never",
            payload: "email_never",
          },
        ],
      },

      [OnboardingStage.PACKAGE_SELECTION]: {
        text: "Awesome! Now let's find the perfect plan for your business. Here's what we offer:",
        cards: [
          {
            title: "Starter",
            description:
              "Perfect for small businesses\n$29/month\n• 100 daily messages\n• 1 bot\n• Basic analytics",
            buttons: [
              {
                title: "Select Starter",
                type: "postback",
                payload: "plan_starter",
              },
            ],
          },
          {
            title: "Professional",
            description:
              "For growing teams\n$79/month\n• 500 daily messages\n• 3 bots\n• Advanced analytics",
            buttons: [
              {
                title: "Select Pro",
                type: "postback",
                payload: "plan_professional",
              },
            ],
          },
          {
            title: "Enterprise",
            description:
              "Custom solution\nContact us\n• Unlimited messages\n• Unlimited bots\n• Priority support",
            buttons: [
              {
                title: "Contact Sales",
                type: "postback",
                payload: "plan_enterprise",
              },
            ],
          },
        ],
      },

      [OnboardingStage.PAYMENT_OR_TRIAL]: {
        text: "Great choice! 🎯 Would you like to start with a free trial first or proceed directly to payment?",
        quickReplies: [
          {
            title: "🎁 Start Free Trial",
            payload: "trial_start",
          },
          {
            title: "💳 Go to Payment",
            payload: "payment_proceed",
          },
        ],
      },

      [OnboardingStage.DEMO_SELECTION]: {
        text: "Perfect! Let's select a demo template that matches your business type. This will give you a head start with pre-built conversation flows.",
        quickReplies: [
          {
            title: "Lead Generation",
            payload: "demo_lead_gen",
          },
          {
            title: "Customer Support",
            payload: "demo_support",
          },
          {
            title: "Product Catalog",
            payload: "demo_catalog",
          },
          {
            title: "Appointment Booking",
            payload: "demo_booking",
          },
        ],
      },

      [OnboardingStage.CONFIRMATION]: {
        text: "🎉 You're all set! Your ReplyBase account is ready.\n\nHere's what comes next:\n1. You'll receive a confirmation email with your login details\n2. Open your dashboard to customize your bot\n3. Our team will reach out soon to support your launch\n\nLet's get you to your dashboard!",
        quickReplies: [
          {
            title: "Open Dashboard",
            payload: "open_dashboard",
          },
        ],
      },

      [OnboardingStage.COMPLETED]: {
        text: "🚀 Welcome aboard! Your onboarding is complete. Check your email for next steps!",
      },
    };

    return (
      messages[stage] || {
        text: "Something went wrong. Please try again later.",
      }
    );
  }

  /**
   * Get validation error message
   */
  static getValidationErrorMessage(stage: OnboardingStage): OnboardingMessage {
    switch (stage) {
      case OnboardingStage.CONTACT_INFO:
        return {
          text: "Oops! That doesn't look like a valid email or phone number. Could you please provide a valid email (e.g., name@business.com) and phone number?",
        };
      case OnboardingStage.COLLECT_INFO:
        return {
          text: "Please provide your name so we can personalize your experience.",
        };
      default:
        return {
          text: "I didn't quite catch that. Could you please try again?",
        };
    }
  }

  /**
   * Update session with collected information
   */
  static async updateSessionInfo(
    sessionId: string,
    data: {
      contactName?: string;
      businessName?: string;
      businessType?: string;
      phone?: string;
      email?: string;
      emailFrequency?: EmailFrequency;
      selectedPlanId?: string;
      demoFlowSelected?: string;
    },
  ) {
    return await prisma.onboardingSession.update({
      where: { id: sessionId },
      data,
    });
  }

  /**
   * Progress to next stage
   */
  static async progressStage(sessionId: string, nextStage: OnboardingStage) {
    return await prisma.onboardingSession.update({
      where: { id: sessionId },
      data: { stage: nextStage },
    });
  }

  /**
   * Mark onboarding as completed
   */
  static async completeOnboarding(sessionId: string) {
    const session = await prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        status: OnboardingStatus.COMPLETED,
        stage: OnboardingStage.COMPLETED,
        completedAt: new Date(),
      },
    });

    // Create or link tenant and subscription
    if (session.email && session.businessName) {
      await this.createTenantFromOnboarding({
        email: session.email,
        businessName: session.businessName,
        selectedPlanId: session.selectedPlanId || undefined,
        contactId: session.contactId,
        phone: session.phone || undefined,
        demoFlowSelected: session.demoFlowSelected || undefined,
      });
    }

    return session;
  }

  /**
   * Create tenant and user account from onboarding session
   */
  static async createTenantFromOnboarding(session: {
    email?: string;
    businessName?: string;
    selectedPlanId?: string;
    contactId: string;
    phone?: string;
    demoFlowSelected?: string;
  }) {
    const {
      email,
      businessName,
      selectedPlanId,
      contactId,
      phone,
      demoFlowSelected,
    } = session;

    // Ensure templates are seeded
    await this.seedDemoTemplates();

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: businessName || "New Business",
      },
    });

    // Create or update subscription if plan selected
    if (selectedPlanId) {
      const plan = await prisma.plan.findUnique({
        where: { id: selectedPlanId },
      });

      if (plan) {
        const currentDate = new Date();
        const endDate = new Date(currentDate);
        endDate.setMonth(endDate.getMonth() + 1);

        await prisma.subscription.create({
          data: {
            stripeId: `temp_${tenant.id}`,
            planId: selectedPlanId,
            tenantId: tenant.id,
            currentPeriodEnd: endDate,
            status: "trial",
            trialEndsAt: endDate,
          },
        });
      }
    }

    // Update contact with tenant association and collected info
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        tenantId: tenant.id,
        email: email || undefined,
        phone: phone || undefined,
      },
    });

    // Create initial flow if demo selected
    if (demoFlowSelected) {
      const template = await prisma.demoTemplate.findFirst({
        where: {
          OR: [
            { id: demoFlowSelected },
            { name: demoFlowSelected },
            { displayName: demoFlowSelected },
          ],
        },
      });

      if (template && template.flowJson) {
        const flowJson = template.flowJson as {
          nodes?: Array<{ type: string; content: Prisma.JsonValue }>;
        };
        const flow = await prisma.flow.create({
          data: {
            name: template.displayName,
            description: template.description,
            tenantId: tenant.id,
            isActive: true,
          },
        });

        if (flowJson.nodes && Array.isArray(flowJson.nodes)) {
          for (let i = 0; i < flowJson.nodes.length; i++) {
            const node = flowJson.nodes[i];
            await prisma.flowNode.create({
              data: {
                flowId: flow.id,
                type: node.type,
                content: node.content as Prisma.InputJsonValue,
                order: i,
              },
            });
          }
        }
      }
    }

    return tenant;
  }

  /**
   * Abandon onboarding session
   */
  static async abandonSession(sessionId: string) {
    return await prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        status: OnboardingStatus.ABANDONED,
      },
    });
  }

  /**
   * Get onboarding metrics
   */
  static async getMetrics(tenantId: string) {
    const sessions = await prisma.onboardingSession.findMany({
      where: {
        tenantId,
      },
    });

    const completedCount = sessions.filter(
      (s) => s.status === OnboardingStatus.COMPLETED,
    ).length;
    const abandonedSessions = sessions.filter(
      (s) => s.status === OnboardingStatus.ABANDONED,
    );

    const abandonmentByStage: Record<string, number> = {};
    abandonedSessions.forEach((s) => {
      const stage = s.stage;
      abandonmentByStage[stage] = (abandonmentByStage[stage] || 0) + 1;
    });

    return {
      totalSessions: sessions.length,
      completedSessions: completedCount,
      abandonedSessions: abandonedSessions.length,
      completionRate: sessions.length
        ? (completedCount / sessions.length) * 100
        : 0,
      abandonmentByStage,
    };
  }
}
