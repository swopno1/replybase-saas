import logger from "./logger";
/**
 * Flow Execution Engine
 *
 * This service handles the execution of conversational flows for Facebook Messenger.
 * It manages flow sessions, processes user responses, and sends messages based on flow nodes.
 */

import { prisma } from "@/lib/prisma";
import { sendTextMessage } from "@/lib/facebook-sender";
import { FlowNode, FlowSession } from "@prisma/client";

export interface FlowExecutionContext {
  userId: string; // Facebook user ID or contact ID
  pageId: string;
  message?: string;
  payload?: string;
}

export interface FlowNodeContent {
  // For message nodes
  text?: string;
  buttons?: Array<{
    type: "postback" | "url";
    title: string;
    payload?: string;
    url?: string;
  }>;
  quick_replies?: Array<{
    title: string;
    payload: string;
    image_url?: string;
  }>;

  // For input nodes
  inputType?: "text" | "email" | "phone" | "number";
  variableName?: string;
  validationMessage?: string;

  // For condition nodes
  conditions?: Array<{
    variableName: string;
    operator: "equals" | "contains" | "greater_than" | "less_than";
    value: string;
    nextNodeOrder?: number;
  }>;

  // For action nodes
  action?: "tag_user" | "update_status" | "send_email" | "end_flow" | "booking" | "checkout" | "schedule" | "trigger_webhook";
  tags?: string[];
  status?: string;
  bookingService?: string;
  checkoutUrl?: string;
  scheduleLink?: string;

  // General
  nextNodeOrder?: number;
}

export class FlowExecutionEngine {
  /**
   * Start or continue a flow execution for a user
   */
  static async executeFlow(context: FlowExecutionContext) {
    try {
      // Get active flow assignment for the page
      const assignment = await prisma.flowAssignment.findFirst({
        where: {
          pageId: context.pageId,
          isActive: true,
        },
        include: {
          flow: {
            include: {
              nodes: {
                orderBy: {
                  order: "asc",
                },
              },
            },
          },
          page: true,
        },
      });

      if (!assignment || !assignment.flow.isActive) {
        return { success: false, reason: "no_active_flow" };
      }

      const flow = assignment.flow;
      const page = assignment.page;

      // Get or create session
      let session = await prisma.flowSession.findFirst({
        where: {
          userId: context.userId,
          pageId: context.pageId,
          flowId: flow.id,
          isActive: true,
        },
      });

      if (!session) {
        // Create new session and start from first node
        session = await prisma.flowSession.create({
          data: {
            userId: context.userId,
            pageId: context.pageId,
            flowId: flow.id,
            variables: {},
            isActive: true,
          },
        });

        // Execute first node
        return await this.executeNode(
          flow.nodes[0],
          session,
          page.accessToken,
          context,
        );
      } else {
        // Continue existing session - session is guaranteed to exist here
        // since we've already handled the case where it doesn't
        const existingSession = session as FlowSession;

        // Find current node
        const currentNodeId = existingSession.currentNodeId;
        const currentNode = currentNodeId
          ? flow.nodes.find((n) => n.id === currentNodeId)
          : null;

        if (!currentNode) {
          // Session exists but no current node - start from beginning
          return await this.executeNode(
            flow.nodes[0],
            existingSession,
            page.accessToken,
            context,
          );
        }

        // Process user response for current node
        const nextNodeOrder = await this.processNodeResponse(
          currentNode,
          existingSession,
          context,
        );

        if (nextNodeOrder === null) {
          // End flow
          await prisma.flowSession.update({
            where: { id: existingSession.id },
            data: {
              isActive: false,
              completedAt: new Date(),
            },
          });

          return { success: true, completed: true };
        }

        // Find and execute next node
        const nextNode = flow.nodes.find((n) => n.order === nextNodeOrder);

        if (!nextNode) {
          // No next node found - end flow
          await prisma.flowSession.update({
            where: { id: existingSession.id },
            data: {
              isActive: false,
              completedAt: new Date(),
            },
          });

          return { success: true, completed: true };
        }

        return await this.executeNode(
          nextNode,
          existingSession,
          page.accessToken,
          context,
        );
      }
    } catch (error) {
      logger.error({ error: error }, "[FlowEngine] Execution error:");
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute a specific node
   */
  private static async executeNode(
    node: FlowNode,
    session: FlowSession,
    pageAccessToken: string,
    context: FlowExecutionContext,
  ): Promise<Record<string, unknown>> {
    const content: FlowNodeContent = node.content as FlowNodeContent;

    // Update session with current node
    await prisma.flowSession.update({
      where: { id: session.id },
      data: { currentNodeId: node.id },
    });

    switch (node.type) {
      case "message":
        return await this.executeMessageNode(
          content,
          session,
          pageAccessToken,
          context,
        );

      case "input":
        return await this.executeInputNode(
          content,
          session,
          pageAccessToken,
          context,
        );

      case "condition":
        return await this.executeConditionNode(
          content,
          node,
          session,
          pageAccessToken,
          context,
        );

      case "action":
        return await this.executeActionNode(
          content,
          node,
          session,
          pageAccessToken,
          context,
        );

      case "end":
        // End the flow
        await prisma.flowSession.update({
          where: { id: session.id },
          data: {
            isActive: false,
            completedAt: new Date(),
          },
        });

        return { success: true, completed: true };

      default:
        logger.error(`[FlowEngine] Unknown node type: ${node.type}`);
        return { success: false, error: "unknown_node_type" };
    }
  }

  /**
   * Execute a message node
   */
  private static async executeMessageNode(
    content: FlowNodeContent,
    session: FlowSession,
    pageAccessToken: string,
    context: FlowExecutionContext,
  ): Promise<{ success: boolean; waiting_for_response: boolean }> {
    const messageText = content.text || "";
    let formattedQuickReplies: Array<{ content_type: string; title: string; payload: string; image_url?: string }> | undefined = undefined;

    if (content.quick_replies && content.quick_replies.length > 0) {
      formattedQuickReplies = content.quick_replies.map(qr => ({
        content_type: "text",
        title: qr.title,
        payload: qr.payload,
        image_url: qr.image_url
      }));
    }

    await sendTextMessage(pageAccessToken, context.userId, messageText, formattedQuickReplies);

    return { success: true, waiting_for_response: true };
  }

  /**
   * Execute an input node
   */
  private static async executeInputNode(
    content: FlowNodeContent,
    session: FlowSession,
    pageAccessToken: string,
    context: FlowExecutionContext,
  ): Promise<{ success: boolean; waiting_for_response: boolean }> {
    await sendTextMessage(
      pageAccessToken,
      context.userId,
      content.text ||
        `Please provide your ${content.variableName || "response"}`,
    );

    return { success: true, waiting_for_response: true };
  }

  /**
   * Execute a condition node
   */
  private static async executeConditionNode(
    content: FlowNodeContent,
    node: FlowNode,
    session: FlowSession,
    pageAccessToken: string,
    context: FlowExecutionContext,
  ): Promise<Record<string, unknown>> {
    const variables = session.variables as Record<
      string,
      string | number | boolean | null
    >;

    // Evaluate conditions
    if (content.conditions) {
      for (const condition of content.conditions) {
        const variableValue = variables[condition.variableName];
        const meets = this.evaluateCondition(
          variableValue,
          condition.operator,
          condition.value,
        );

        if (meets && condition.nextNodeOrder !== undefined) {
          // Find next node by order
          const flow = await prisma.flow.findUnique({
            where: { id: session.flowId },
            include: {
              nodes: {
                where: { order: condition.nextNodeOrder },
              },
            },
          });

          if (flow && flow.nodes[0]) {
            return await this.executeNode(
              flow.nodes[0],
              session,
              pageAccessToken,
              context,
            );
          }
        }
      }
    }

    // Default: move to next node in sequence
    return { success: true, nextNodeOrder: node.order + 1 };
  }

  /**
   * Execute an action node
   */
  private static async executeActionNode(
    content: FlowNodeContent,
    node: FlowNode,
    session: FlowSession,
    pageAccessToken: string,
    context: FlowExecutionContext,
  ): Promise<{
    success: boolean;
    completed?: boolean;
    nextNodeOrder?: number;
  }> {
    switch (content.action) {
      case "tag_user":
        if (content.tags) {
          // Find or create lead
          const lead = await prisma.lead.findFirst({
            where: {
              pageId: context.pageId,
              source: "facebook",
              metadata: {
                path: ["facebookUserId"],
                equals: context.userId,
              },
            },
          });

          if (lead) {
            const currentTags = (lead.tags as string[]) || [];
            const newTags = Array.from(
              new Set([...currentTags, ...content.tags]),
            );

            await prisma.lead.update({
              where: { id: lead.id },
              data: { tags: newTags },
            });
          }
        }
        break;

      case "update_status":
        if (content.status) {
          const lead = await prisma.lead.findFirst({
            where: {
              pageId: context.pageId,
              source: "facebook",
              metadata: {
                path: ["facebookUserId"],
                equals: context.userId,
              },
            },
          });

          if (lead) {
            await prisma.lead.update({
              where: { id: lead.id },
              data: { status: content.status },
            });
          }
        }
        break;

      case "end_flow":
        await prisma.flowSession.update({
          where: { id: session.id },
          data: {
            isActive: false,
            completedAt: new Date(),
          },
        });

        return { success: true, completed: true };

      case "trigger_webhook": {
        const lead = await prisma.lead.findFirst({
          where: {
            OR: [
              {
                source: "facebook",
                metadata: { path: ["facebookUserId"], equals: context.userId },
              },
              {
                source: "whatsapp",
                metadata: { path: ["whatsappUserId"], equals: context.userId },
              },
              {
                source: "website",
                contactId: context.userId, // for webchat
              },
            ],
          },
        });

        if (lead) {
          const { dispatchWebhook } = await import("@/lib/services/webhook-dispatcher");
          await dispatchWebhook(lead.tenantId, "flow.action", {
            leadId: lead.id,
            action: content.action,
            nodeId: node.id,
            variables: session.variables,
          });
        }
        break;
      }

      case "booking":
      case "checkout":
      case "schedule": {
        // Find lead across all channels, not just facebook
        const lead = await prisma.lead.findFirst({
          where: {
            pageId: context.pageId,
            // Match the user ID in the appropriate source path
            OR: [
              {
                source: "facebook",
                metadata: { path: ["facebookUserId"], equals: context.userId },
              },
              {
                source: "whatsapp",
                metadata: { path: ["whatsappUserId"], equals: context.userId },
              },
              {
                source: "website",
                contactId: context.userId, // for webchat
              },
            ],
          },
        });

        if (lead) {
          const currentTags = (lead.tags as string[]) || [];
          const actionTag = `${content.action}-initiated`;
          // Preserve any tags specified on the node plus the action tag
          const nodeTags = content.tags || [];
          const newTags = Array.from(new Set([...currentTags, actionTag, ...nodeTags]));

          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              tags: newTags,
              status: "contacted"
            },
          });
        }

        // TODO: In the future, emit an event here to trigger external API webhooks
        // (Stripe for checkout, Calendly for schedule, etc.)

        return { success: true, nextNodeOrder: content.nextNodeOrder ?? node.order + 1 };
      }
    }

    // Move to next node
    return { success: true, nextNodeOrder: content.nextNodeOrder ?? node.order + 1 };
  }

  /**
   * Process user response for current node
   */
  private static async processNodeResponse(
    node: FlowNode,
    session: FlowSession,
    context: FlowExecutionContext,
  ): Promise<number | null> {
    const content: FlowNodeContent = node.content as FlowNodeContent;
    const variables = {
      ...(session.variables as Record<
        string,
        string | number | boolean | null
      >),
    };

    if (node.type === "input" && context.message) {
      // Store input value
      const variableName = content.variableName || `input_${node.order}`;
      variables[variableName] = context.message;

      // Update session variables
      await prisma.flowSession.update({
        where: { id: session.id },
        data: { variables },
      });

      // Move to next node
      return content.nextNodeOrder ?? node.order + 1;
    }

    if (node.type === "message") {
      // Message sent, move to next node
      return content.nextNodeOrder ?? node.order + 1;
    }

    // Default: move to next node
    return content.nextNodeOrder ?? node.order + 1;
  }

  /**
   * Evaluate a condition
   */
  private static evaluateCondition(
    value: string | number | boolean | null | undefined,
    operator: string,
    compareValue: string,
  ): boolean {
    switch (operator) {
      case "equals":
        return String(value).toLowerCase() === compareValue.toLowerCase();

      case "contains":
        return String(value).toLowerCase().includes(compareValue.toLowerCase());

      case "greater_than":
        return Number(value) > Number(compareValue);

      case "less_than":
        return Number(value) < Number(compareValue);

      default:
        return false;
    }
  }
}
