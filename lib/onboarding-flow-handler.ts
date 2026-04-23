import { OnboardingService, OnboardingMessage } from "@/lib/onboarding-service";
import { prisma } from "@/lib/prisma";
import { OnboardingStage, EmailFrequency } from "@prisma/client";
import { generateAppSecretProof } from "@/lib/server/facebook-utils";

const FACEBOOK_API_URL = "https://graph.facebook.com/v19.0";

export class OnboardingFlowHandler {
  /**
   * Handle incoming webhook message for onboarding
   */
  static async handleMessage(
    pageId: string,
    senderId: string,
    messageText: string,
    conversationId: string,
    contactId: string,
    pageAccessToken: string,
  ) {
    // Get or create onboarding session
    const session = await OnboardingService.getOrCreateSession(
      pageId,
      conversationId,
      contactId,
    );

    // Parse the message to determine next action
    const action = this.parseMessageAction(messageText, session.stage);

    // Update session based on message content and check if valid
    const isValid = await this.processMessageContent(
      session.id,
      messageText,
      session.stage,
    );

    // Determine next stage
    let nextStage = session.stage;
    let respondWithMessage: OnboardingMessage | null = null;

    // Only progress if input was valid for the current stage
    if (!isValid && action !== "get_started") {
      respondWithMessage = OnboardingService.getValidationErrorMessage(
        session.stage,
      );
      nextStage = session.stage;
    } else {
      switch (action) {
        case "get_started":
          nextStage = OnboardingStage.COLLECT_INFO;
          respondWithMessage = OnboardingService.getStageMessage(nextStage);
          break;

        case "name_provided":
          nextStage = OnboardingStage.BUSINESS_TYPE;
          respondWithMessage = OnboardingService.getStageMessage(nextStage);
          break;

        case "business_selected":
          nextStage = OnboardingStage.CONTACT_INFO;
          respondWithMessage = OnboardingService.getStageMessage(nextStage);
          break;

        case "contact_provided":
          nextStage = OnboardingStage.EMAIL_PREFERENCE;
          respondWithMessage = OnboardingService.getStageMessage(nextStage);
          break;

        case "email_preference_set":
          nextStage = OnboardingStage.PACKAGE_SELECTION;
          respondWithMessage = OnboardingService.getStageMessage(nextStage);
          break;

        case "plan_selected":
          nextStage = OnboardingStage.PAYMENT_OR_TRIAL;
          respondWithMessage = OnboardingService.getStageMessage(nextStage);
          break;

        case "trial_selected":
          nextStage = OnboardingStage.DEMO_SELECTION;
          respondWithMessage = OnboardingService.getStageMessage(nextStage);
          break;

        case "demo_selected":
          nextStage = OnboardingStage.CONFIRMATION;
          respondWithMessage = OnboardingService.getStageMessage(nextStage);
          break;

        case "payment_confirmed":
          nextStage = OnboardingStage.CONFIRMATION;
          respondWithMessage = OnboardingService.getStageMessage(nextStage);
          break;

        case "dashboard_opened":
          await OnboardingService.completeOnboarding(session.id);
          nextStage = OnboardingStage.COMPLETED;
          break;

        default:
          respondWithMessage = OnboardingService.getStageMessage(session.stage);
      }
    }

    // Update session to next stage
    await OnboardingService.progressStage(session.id, nextStage);

    // Send response message
    if (respondWithMessage) {
      await this.sendMessage(
        pageId,
        senderId,
        respondWithMessage,
        pageAccessToken,
      );
    }
  }

  /**
   * Parse quick reply payloads
   */
  static parseMessageAction(
    text: string,
    currentStage: OnboardingStage,
  ): string {
    const lower = text.toLowerCase().trim();

    if (lower.includes("get_started")) return "get_started";
    if (lower.includes("business_")) return "business_selected";
    if (lower.includes("email_")) return "email_preference_set";
    if (lower.includes("plan_")) return "plan_selected";
    if (lower.includes("trial_start")) return "trial_selected";
    if (lower.includes("demo_")) return "demo_selected";
    if (lower.includes("payment_proceed")) return "payment_confirmed";
    if (lower.includes("open_dashboard")) return "dashboard_opened";

    // Context-aware parsing
    switch (currentStage) {
      case OnboardingStage.COLLECT_INFO:
        return "name_provided";
      case OnboardingStage.CONTACT_INFO:
        return "contact_provided";
      default:
        return "continue";
    }
  }

  /**
   * Process and store the message content based on stage
   * Returns true if valid content was processed, false otherwise
   */
  static async processMessageContent(
    sessionId: string,
    content: string,
    stage: OnboardingStage,
  ): Promise<boolean> {
    const session = await prisma.onboardingSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) return false;

    const updateData: Partial<{
      contactName?: string;
      businessName?: string;
      businessType?: string;
      phone?: string;
      email?: string;
      emailFrequency?: EmailFrequency;
      demoFlowSelected?: string;
    }> = {};

    let isValid = true;

    switch (stage) {
      case OnboardingStage.COLLECT_INFO:
        if (content.length < 2) {
          isValid = false;
        } else {
          updateData.contactName = content;
          updateData.businessName = content; // Can ask separately later
        }
        break;

      case OnboardingStage.BUSINESS_TYPE:
        const businessTypeMap: Record<string, string> = {
          ecommerce: "ecommerce",
          service: "service",
          saas: "saas",
          agency: "agency",
          other: "other",
        };
        const type = Object.entries(businessTypeMap).find(([key]) =>
          content.toLowerCase().includes(key),
        )?.[1];
        if (type) {
          updateData.businessType = type;
        } else if (!content.toLowerCase().includes("business_")) {
          isValid = false;
        }
        break;

      case OnboardingStage.CONTACT_INFO:
        // Parse email and phone from message
        const emailMatch = content.match(/([^\s@]+@[^\s@]+\.[^\s@]+)/);
        const phoneMatch = content.match(/(\+?[\d\s-()]{10,})/);

        if (emailMatch) updateData.email = emailMatch[1];
        if (phoneMatch) updateData.phone = phoneMatch[1];

        // Require at least email for this stage to be "valid"
        if (!emailMatch) isValid = false;
        break;

      case OnboardingStage.EMAIL_PREFERENCE:
        const frequencyMap: Record<string, EmailFrequency> = {
          daily: EmailFrequency.DAILY,
          weekly: EmailFrequency.WEEKLY,
          monthly: EmailFrequency.MONTHLY,
          never: EmailFrequency.NEVER,
        };
        const freq = Object.entries(frequencyMap).find(([key]) =>
          content.toLowerCase().includes(key),
        )?.[1];
        if (freq) updateData.emailFrequency = freq;
        break;

      case OnboardingStage.PACKAGE_SELECTION:
        // Will be handled by quick reply payload
        break;

      case OnboardingStage.DEMO_SELECTION:
        updateData.demoFlowSelected = content;
        break;
    }

    if (Object.keys(updateData).length > 0) {
      await OnboardingService.updateSessionInfo(sessionId, updateData);
    }

    return isValid;
  }

  /**
   * Send formatted message to Facebook Messenger
   */
  static async sendMessage(
    pageId: string,
    recipientId: string,
    message: OnboardingMessage,
    pageAccessToken: string,
  ) {
    try {
      type MessagePayload = {
        recipient: { id: string };
        message: Record<string, unknown>;
      };

      const messagePayload: MessagePayload = {
        recipient: { id: recipientId },
        message: {},
      };

      // Add delay if specified
      if (message.delay) {
        await new Promise((resolve) => setTimeout(resolve, message.delay));
      }

      // Build message based on content type
      if (message.cards && message.cards.length > 0) {
        messagePayload.message = {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: message.cards.map((card) => ({
                title: card.title,
                subtitle: card.description,
                image_url: card.image_url,
                buttons: card.buttons?.map((btn) => ({
                  type: btn.type,
                  title: btn.title,
                  payload: btn.payload,
                  url: btn.url,
                })),
              })),
            },
          },
        };
      } else if (message.quickReplies && message.quickReplies.length > 0) {
        messagePayload.message = {
          text: message.text,
          quick_replies: message.quickReplies.map((qr) => ({
            content_type: "text",
            title: qr.title,
            payload: qr.payload,
          })),
        };
      } else {
        messagePayload.message = { text: message.text };
      }

      const url = new URL(`${FACEBOOK_API_URL}/${pageId}/messages`);
      url.searchParams.set("access_token", pageAccessToken);
      const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
      if (appSecret) {
        url.searchParams.set(
          "appsecret_proof",
          generateAppSecretProof(pageAccessToken, appSecret),
        );
      }

      await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      }).catch((error) => {
        console.error("[Onboarding] Failed to send message:", error);
      });
    } catch (error) {
      console.error("[Onboarding] Error in sendMessage:", error);
    }
  }

  /**
   * Get dashboard redirect URL for onboarded client
   */
  static async getDashboardRedirectUrl(sessionId: string): Promise<string> {
    const session = await prisma.onboardingSession.findUnique({
      where: { id: sessionId },
    });

    if (!session?.tenantId) {
      throw new Error("No tenant created for this session");
    }

    // Generate a one-time login link or return dashboard URL
    return `/dashboard?onboarding_complete=${sessionId}`;
  }
}
