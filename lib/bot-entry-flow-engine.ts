import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkTenantUsageLimits } from "@/lib/subscription";
import {
  createInitialRuntimeState,
  evaluateCondition,
  FlowNodeContent,
  getNextNode,
  getRuntimeState,
  interpolateText,
  loadAccessibleFlow,
  normalizeDurationMs,
  resolveReferencedFlow,
  resumeParentFlow,
  sanitizeNameInput,
  setRuntimeState,
  FlowWithOrderedNodes,
} from "@/lib/flow-runtime-utils";

export type FlowResponseQuickReply = {
  content_type: "text";
  title: string;
  payload: string;
};

export type FlowResponse =
  | { type: "text"; text: string; quickReplies?: FlowResponseQuickReply[] }
  | { type: "typing"; durationMs: number };

export interface ExecutionTraceStep {
  nodeId: string;
  type: string;
  status: "success" | "failure" | "skipped";
  variablesBefore: Record<string, unknown>;
  variablesAfter: Record<string, unknown>;
  responses: FlowResponse[];
  error?: string;
  durationMs?: number;
}

const MIN_TYPING_DELAY_MS = 300;

async function applyDelayWithOptionalTyping(
  content: FlowNodeContent,
  responses: FlowResponse[],
  explicitDelayMs?: number,
) {
  const delayMs = normalizeDurationMs(explicitDelayMs ?? content.delayMs);
  if (!content.typingEnabled) {
    // No server-side wait — delays are handled during per-channel dispatch
    void delayMs;
    return;
  }

  const typingDurationMs = delayMs > 0 ? delayMs : MIN_TYPING_DELAY_MS;
  responses.push({ type: "typing", durationMs: typingDurationMs });
  // No server-side wait — dispatch loop handles timing from durationMs
}

// Sessions older than this without activity are considered abandoned and reset.
const STALE_SESSION_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

async function resolveFlow(params: {
  isSimulation?: boolean;
  tenantId: string;
  contactId: string;
  scopeKey: string;
  channelId?: string;
  entryFlow?: string | null;
  variables?: Record<string, unknown>;
}) {
  if (params.isSimulation) {
    const isNewSession = !params.variables || Object.keys(params.variables).length === 0;

    // If the flow completed in a previous turn (last_node_id is set to null), transition to AI fallback
    if (!isNewSession && params.variables && params.variables.last_node_id === null) {
      return null;
    }

    let targetFlowId = params.entryFlow;
    if (params.channelId) {
      const channelAssignment = await prisma.flowChannelAssignment.findFirst({
        where: { channelId: params.channelId, isActive: true },
        select: { flowId: true },
      });
      if (channelAssignment) targetFlowId = channelAssignment.flowId;
    }

    // Skip Default Welcome resolution in simulation if the bot is explicitly configured without a flow
    if (!targetFlowId) {
      return null;
    }

    const configuredFlow = await prisma.flow.findFirst({
      where: {
        tenantId: params.tenantId,
        isActive: true,
        OR: [
          ...(targetFlowId ? [{ id: targetFlowId }] : []),
          ...(targetFlowId ? [{ name: targetFlowId }] : []),
          { isGlobal: true, name: "Default Welcome" }
        ],
      },
      include: {
        nodes: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!configuredFlow) {
      return null;
    }

    let flow: FlowWithOrderedNodes = configuredFlow;
    let currentNodeId = flow.nodes[0]?.id || null;

    if (!isNewSession && params.variables) {
      const runtime = getRuntimeState(params.variables, configuredFlow.id);
      currentNodeId = (params.variables.last_node_id as string) || flow.nodes[0]?.id || null;
      if (runtime.activeFlowId && runtime.activeFlowId !== configuredFlow.id) {
        const activeFlow = await loadAccessibleFlow({
          tenantId: params.tenantId,
          flowId: runtime.activeFlowId,
        });
        if (activeFlow) {
          flow = activeFlow;
          if (!params.variables.last_node_id) {
            currentNodeId = activeFlow.nodes[0]?.id || null;
          }
        }
      }
    }

    const contact = await prisma.contact.findUnique({
      where: { id: params.contactId },
      select: { 
        name: true,
        leads: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { businessType: true }
        }
      },
    });
    const businessType = contact?.leads[0]?.businessType || "";

    const mockSession = {
      id: "sim-session-id",
      userId: params.contactId,
      pageId: params.scopeKey,
      flowId: configuredFlow.id,
      currentNodeId,
      variables: isNewSession ? {
        __runtime: createInitialRuntimeState(configuredFlow.id),
        contact_name: contact?.name || "",
        business_type: businessType,
        sync_hash: "sim-session-id",
      } : params.variables,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    };

    return { flow, session: mockSession, isNewSession };
  }

  // --- MODULE 1: SUBSCRIPTION STATE ROUTER ---
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: params.tenantId },
    include: { plan: true },
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    select: { trialUsed: true },
  });

  const activeSession = await prisma.flowSession.findFirst({
    where: {
      userId: params.contactId,
      pageId: params.scopeKey,
      isActive: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  // Handle Returning User Intelligence (Memory TTL)
  if (activeSession) {
    const sessionAge = Date.now() - activeSession.updatedAt.getTime();
    if (sessionAge < STALE_SESSION_AGE_MS) {
      // Recent session — resume from where the visitor left off.
      const variables = (activeSession.variables as Record<string, unknown>) || {};
      const runtime = getRuntimeState(variables, activeSession.flowId);
      const flow = await loadAccessibleFlow({
        tenantId: params.tenantId,
        flowId: runtime.activeFlowId,
      });

      if (flow) {
        return { flow, session: activeSession, isNewSession: false };
      }
    } else {
      // Stale session (> 24 h inactive) — expire it.
      if (!params.isSimulation) await prisma.flowSession.update({
        where: { id: activeSession.id },
        data: { isActive: false },
      });
    }
  }

  // --- STATE-AWARE ROUTING LOGIC ---
  let targetFlowId = params.entryFlow;

  // 1. Check for specific channel flow assignments (Takes precedence over bot default)
  if (params.channelId) {
    const channelAssignment = await prisma.flowChannelAssignment.findFirst({
      where: { channelId: params.channelId, isActive: true },
      select: { flowId: true },
    });
    if (channelAssignment) targetFlowId = channelAssignment.flowId;
  }

  // 2. Subscription state logic
  if (subscription?.status === "active") {
    // Returning customer — can be used for support routing
  } else if (tenant?.trialUsed) {
    const trialConsumedFlow = await prisma.flow.findFirst({
      where: { tenantId: params.tenantId, name: { contains: "Upgrade" }, isActive: true },
    });
    if (trialConsumedFlow) targetFlowId = trialConsumedFlow.id;
  }

  // Enforce a cooldown before allowing the flow to restart
  const FLOW_REPEAT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
  const recentlyCompleted = await prisma.flowSession.findFirst({
    where: {
      userId: params.contactId,
      pageId: params.scopeKey,
      isActive: false,
      completedAt: {
        gte: new Date(Date.now() - FLOW_REPEAT_COOLDOWN_MS),
      },
    },
    orderBy: { completedAt: "desc" },
  });

  if (recentlyCompleted) {
    return null;
  }

  async function startFlowSession(
    flow: Awaited<ReturnType<typeof loadAccessibleFlow>> extends infer T
      ? NonNullable<T>
      : never,
  ) {
    // Inject identity traits into starting variables for greeting logic
    const contact = await prisma.contact.findUnique({
      where: { id: params.contactId },
      select: { 
        name: true,
        leads: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { businessType: true }
        }
      },
    });

    const businessType = contact?.leads[0]?.businessType || "";

    const session = await prisma.flowSession.create({
      data: {
        userId: params.contactId,
        pageId: params.scopeKey,
        flowId: flow.id,
        currentNodeId: flow.nodes[0]?.id || null,
        variables: {
          __runtime: createInitialRuntimeState(flow.id),
          contact_name: contact?.name || "",
          business_type: businessType,
          sync_hash: "", // Placeholder, will be set after session is created
        },
        isActive: true,
      },
    });

    // Update with the session ID as sync_hash for cross-channel parity
    const updatedSession = await prisma.flowSession.update({
      where: { id: session.id },
      data: {
        variables: {
          ...(session.variables as Prisma.JsonObject),
          sync_hash: session.id,
        },
      },
    });

    return { flow, session: updatedSession, isNewSession: true };
  }

  // Final resolution logic
  const configuredFlow = await prisma.flow.findFirst({
    where: {
      tenantId: params.tenantId,
      isActive: true,
      OR: [
        ...(targetFlowId ? [{ id: targetFlowId }] : []),
        ...(targetFlowId ? [{ name: targetFlowId }] : []),
        { isGlobal: true, name: "Default Welcome" }
      ],
    },
    include: {
      nodes: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!configuredFlow) {
    return null;
  }

  return startFlowSession(configuredFlow);
}

function getVariableString(
  variables: Record<string, unknown>,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = variables[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function mergeTags(existing: unknown, incoming?: string[]) {
  const currentTags = Array.isArray(existing)
    ? existing.filter(
        (tag: unknown): tag is string =>
          typeof tag === "string" && tag.trim().length > 0,
      )
    : [];
  const nextTags = Array.isArray(incoming)
    ? incoming.filter((tag) => typeof tag === "string" && tag.trim().length > 0)
    : [];

  return Array.from(new Set([...currentTags, ...nextTags]));
}

async function persistLeadCapture(params: {
  isSimulation?: boolean;
  tenantId: string;
  contactId: string;
  flowId: string;
  variables: Record<string, unknown>;
  tags?: string[];
  status?: string;
  channelId?: string;
}) {
  const name = getVariableString(
    params.variables,
    "lead_name",
    "name",
    "contact_name",
    "customer_name",
    "client_name",
    "member_name",
    "guest_name",
  );
  const email = getVariableString(
    params.variables,
    "lead_email",
    "email",
    "contact_email",
    "work_email",
    "email_address",
  );
  const phone = getVariableString(
    params.variables,
    "lead_phone",
    "phone",
    "mobile",
    "contact_phone",
    "phone_number",
    "client_phone",
  );
  const company = getVariableString(
    params.variables,
    "lead_company",
    "company",
  );
  const need = getVariableString(
    params.variables,
    "lead_need",
    "businessType",
    "business_type",
  );
  const budget = getVariableString(params.variables, "lead_budget", "budget");

  if (!name && !email && !phone && !company && !need && !budget && !params.tags && !params.status) {
    return;
  }

  const contactData = {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };

  if (Object.keys(contactData).length > 0) {
    if (!params.isSimulation) await prisma.contact.update({
      where: { id: params.contactId },
      data: contactData,
    });
  }

  const existingLead = await prisma.lead.findFirst({
    where: {
      tenantId: params.tenantId,
      contactId: params.contactId,
    },
    orderBy: { updatedAt: "desc" },
  });

  const existingMetadata =
    existingLead?.metadata &&
    typeof existingLead.metadata === "object" &&
    !Array.isArray(existingLead.metadata)
      ? (existingLead.metadata as Record<string, unknown>)
      : {};

  const INTERNAL_VARIABLE_KEYS = new Set([
    "__runtime",
    "contact_name",
    "contact_name_prefix",
    "contact_email",
    "contact_phone",
    "contact_is_qualified",
    "last_user_message",
    "last_user_message_normalized",
  ]);
  const previousFlowInputs =
    existingMetadata.flowInputs &&
    typeof existingMetadata.flowInputs === "object" &&
    !Array.isArray(existingMetadata.flowInputs)
      ? (existingMetadata.flowInputs as Record<string, string>)
      : {};
  const newFlowInputs: Record<string, string> = {};
  for (const [k, v] of Object.entries(params.variables)) {
    if (
      !INTERNAL_VARIABLE_KEYS.has(k) &&
      v !== null &&
      v !== undefined &&
      v !== "" &&
      typeof v !== "object"
    ) {
      newFlowInputs[k] = String(v);
    }
  }

  const leadData = {
    tenantId: params.tenantId,
    contactId: params.contactId,
    flowId: params.flowId,
    name: name ?? undefined,
    email: email ?? undefined,
    mobile: phone ?? undefined,
    company: company ?? undefined,
    businessType: need ?? undefined,
    source: "social_flow",
    status: params.status || existingLead?.status || "contacted",
    tags: mergeTags(existingLead?.tags, params.tags),
    metadata: {
      ...existingMetadata,
      channelId: params.channelId,
      captureSource: "social_flow",
      need,
      budget,
      lastUserMessage: getVariableString(params.variables, "last_user_message"),
      flowInputs: { ...previousFlowInputs, ...newFlowInputs },
    } as Prisma.InputJsonValue,
  };

  if (existingLead) {
    if (!params.isSimulation) await prisma.lead.update({
      where: { id: existingLead.id },
      data: leadData,
    });
    return;
  }

  if (!params.isSimulation) await prisma.lead.create({
    data: leadData,
  });
}

import { incrementTenantUsage } from "./subscription";

export async function executeBotEntryFlowFirst(params: {
  isSimulation?: boolean;
  tenantId: string;
  botId: string;
  contactId: string;
  scopeKey: string;
  message: string;
  channelId?: string;
  entryFlow?: string | null;
  variables?: Record<string, unknown>;
}) {
  const resolved = await resolveFlow(params);
  if (!resolved) {
    return null;
  }

  // Centralized usage tracking for flow executions
  if (!params.isSimulation) await incrementTenantUsage(
    params.tenantId,
    "flow_execution",
    1,
    params.botId,
    params.channelId,
  );

  let activeFlow = resolved.flow;
  const { session } = resolved;
  if (!activeFlow.nodes.length) {
    return {
      handled: Boolean(activeFlow.fallbackMessage),
      responses: activeFlow.fallbackMessage
        ? [{ type: "text" as const, text: activeFlow.fallbackMessage, quickReplies: [] }]
        : [],
      flowId: activeFlow.id,
      flowName: activeFlow.name,
      flowSessionId: session.id,
      completed: true,
      fallbackMessage: activeFlow.fallbackMessage || null,
    };
  }

  const mergedVariables = {
    ...((session.variables as Record<string, unknown> | null) || {}),
    ...(params.variables || {}),
  };

  // Inject contact identity so flow nodes can gate on contact_is_qualified
  // without hitting the DB again.  "true"/"false" strings are used because
  // the condition evaluator compares values as strings.
  const contactRecord = await prisma.contact.findFirst({
    where: { id: params.contactId, tenantId: params.tenantId },
    select: { name: true, email: true, phone: true },
  });
  mergedVariables.contact_name = contactRecord?.name ?? "";
  mergedVariables.contact_name_prefix = contactRecord?.name
    ? `, ${contactRecord.name}`
    : "";
  mergedVariables.contact_email = contactRecord?.email ?? "";
  mergedVariables.contact_phone = contactRecord?.phone ?? "";
  mergedVariables.contact_is_qualified = contactRecord?.email
    ? "true"
    : "false";
  mergedVariables.session_id = session.id;
  mergedVariables.sync_hash = ((session.variables as Prisma.JsonObject)?.sync_hash as string) || session.id;

  const runtime = getRuntimeState(mergedVariables, session.flowId);
  const responses: FlowResponse[] = [];
  let pendingMessage = resolved.isNewSession ? "" : params.message.trim();

  if (pendingMessage) {
    mergedVariables.last_user_message = pendingMessage;
    mergedVariables.last_user_message_normalized = pendingMessage.toLowerCase();
  }

  let currentNode: (typeof activeFlow.nodes)[number] | null =
    activeFlow.nodes.find((node) => node.id === session.currentNodeId) ||
    activeFlow.nodes[0];
  let completed = false;
  let safetyCounter = 0;
  const executionTrace: ExecutionTraceStep[] = [];

  while (currentNode && safetyCounter < 30) {
    const variablesBefore = { ...mergedVariables };
    safetyCounter += 1;
    const content = (currentNode.content || {}) as FlowNodeContent;

    switch (currentNode.type) {
      case "message": {
        const text = content.text
          ? interpolateText(content.text, mergedVariables)
          : "";
        const quickReplies = content.quick_replies || content.buttons;

        if (pendingMessage && quickReplies && quickReplies.length > 0) {
          // If we have a pending message and this node has quick replies,
          // we treat it as the response to those quick replies.
          const variableName = content.variableName || `msg_${currentNode.order}`;
          mergedVariables[variableName] = pendingMessage;
          pendingMessage = ""; // Consume it
          
          await applyDelayWithOptionalTyping(content, responses);
          currentNode = getNextNode(
            activeFlow.nodes,
            currentNode.order,
            content.nextNodeOrder,
          );
          break;
        }

        if (text.trim()) {
          const quickRepliesMapped = quickReplies && quickReplies.length > 0
            ? quickReplies.map((qr) => ({
                content_type: "text" as const,
                title: qr.title,
                payload: qr.payload || qr.title,
              }))
            : undefined;

          responses.push({
            type: "text",
            text: text.trim(),
            quickReplies: quickRepliesMapped,
          });
        }
        
        await applyDelayWithOptionalTyping(content, responses);

        // If it has quick replies and we haven't consumed a pending message yet,
        // we must STOP and wait for the user to click one.
        if (quickReplies && quickReplies.length > 0 && !pendingMessage) {
          safetyCounter = 99; // Stop execution
          break;
        }

        currentNode = getNextNode(
          activeFlow.nodes,
          currentNode.order,
          content.nextNodeOrder,
        );

        if (params.isSimulation) {
          executionTrace.push({
            nodeId: variablesBefore.last_node_id as string || "start",
            type: "logic",
            status: "success",
            variablesBefore,
            variablesAfter: { ...mergedVariables },
            responses: [...responses],
          });
        }
        break;
      }
      case "input": {
        const variableName =
          content.variableName || `input_${currentNode.order}`;
        if (pendingMessage) {
          if (content.inputType === "email") {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(pendingMessage.trim())) {
              const validationPrompt = content.validationMessage || "Please enter a valid email address.";
              responses.push({
                type: "text",
                text: validationPrompt,
              });
              pendingMessage = "";
              safetyCounter = 99;
              break;
            }
          }

          const isNameVar = variableName === "contact_name" || variableName === "lead_name" || variableName === "name";
          mergedVariables[variableName] = isNameVar ? sanitizeNameInput(pendingMessage) : pendingMessage.trim();
          pendingMessage = "";
          await applyDelayWithOptionalTyping(content, responses);
          currentNode = getNextNode(
            activeFlow.nodes,
            currentNode.order,
            content.nextNodeOrder,
          );
          break;
        }

        const prompt = content.text || `Please provide your ${variableName}`;
        responses.push({
          type: "text",
          text: interpolateText(prompt, mergedVariables),
        });
        safetyCounter = 99;
        break;
      }
      case "condition": {
        let nextNode = null;
        if (content.conditions) {
          for (const condition of content.conditions) {
            // Fall back to parent content.variableName when individual
            // condition entries don't specify their own variableName.
            const varName = condition.variableName || content.variableName;
            if (
              varName &&
              evaluateCondition(
                mergedVariables[varName] as
                  | string
                  | number
                  | boolean
                  | null
                  | undefined,
                condition.operator,
                condition.value,
              )
            ) {
              nextNode = getNextNode(
                activeFlow.nodes,
                currentNode.order,
                condition.nextNodeOrder,
              );
              break;
            }
          }
        }
        await applyDelayWithOptionalTyping(content, responses);
        currentNode =
          nextNode ||
          getNextNode(
            activeFlow.nodes,
            currentNode.order,
            content.nextNodeOrder,
          );
        break;
      }
      case "action": {
        if (content.action === "tag_user") {
          const tagValues = (content as { tags?: unknown[] }).tags;
          const tags = Array.isArray(tagValues)
            ? tagValues.filter(
                (tag): tag is string =>
                  typeof tag === "string" && tag.trim().length > 0,
              )
            : undefined;

          await persistLeadCapture({
            isSimulation: params.isSimulation,
            tenantId: params.tenantId,
            contactId: params.contactId,
            flowId: runtime.rootFlowId,
            variables: mergedVariables,
            tags,
            channelId: params.channelId,
          });
        }

        if (content.action === "update_status") {
          await persistLeadCapture({
            isSimulation: params.isSimulation,
            tenantId: params.tenantId,
            contactId: params.contactId,
            flowId: runtime.rootFlowId,
            variables: mergedVariables,
            status:
              typeof (content as { status?: unknown }).status === "string"
                ? (content as { status?: string }).status
                : undefined,
            channelId: params.channelId,
          });
        }

        if (content.action === "call_flow") {
          const referencedFlow = await resolveReferencedFlow({
            tenantId: params.tenantId,
            targetFlowId: content.targetFlowId,
            targetFlowName: content.targetFlowName,
          });

          if (referencedFlow?.nodes.length) {
            runtime.callStack.push({
              flowId: activeFlow.id,
              nextNodeOrder: content.nextNodeOrder ?? currentNode.order + 1,
            });
            runtime.activeFlowId = referencedFlow.id;
            activeFlow = referencedFlow;
            currentNode = referencedFlow.nodes[0] || null;
            break;
          }
        }

        if (content.action === "checkout") {
          const tenant = await prisma.tenant.findUnique({
            where: { id: params.tenantId },
            select: { trialUsed: true },
          });
          const stripeUrl = tenant?.trialUsed 
            ? `https://buy.stripe.com/payment?client_reference_id=${params.tenantId}&customer_email=${mergedVariables.contact_email}`
            : `https://buy.stripe.com/trial?client_reference_id=${params.tenantId}&customer_email=${mergedVariables.contact_email}`;

          responses.push({
            type: "text",
            text: interpolateText(content.text || "I've pre-configured your secure checkout page. You can start in seconds here: {{stripe_url}}", { ...mergedVariables, stripe_url: stripeUrl }),
          });
        }

        if (content.action === "booking") {
          if (!params.isSimulation) await prisma.activityLog.create({
            data: {
              tenantId: params.tenantId,
              type: "BOOKING_REQUESTED",
              title: "Demo Walkthrough Requested",
              description: `User ${mergedVariables.contact_email} requested a demo for ${mergedVariables.business_type}`,
              metadata: { variables: mergedVariables } as Prisma.JsonObject,
            },
          });
          responses.push({
            type: "text",
            text: content.text || "I've forwarded your requirements to our specialist. They'll reach out to schedule your walkthrough shortly!",
          });
        }

        if (content.action === "end_flow") {
          const resumed = await resumeParentFlow({
            tenantId: params.tenantId,
            runtime,
          });
          if (resumed) {
            activeFlow = resumed.flow;
            currentNode = resumed.node;
            break;
          }

          completed = true;
          currentNode = null;
          break;
        }

        if (content.action === "trigger_webhook") {
          const { dispatchWebhook } = await import("@/lib/services/webhook-dispatcher");
          if (!params.isSimulation) await dispatchWebhook(params.tenantId, "flow.action", {
            contactId: params.contactId,
            action: content.action,
            nodeId: currentNode.id,
            variables: mergedVariables,
          });
        }

        await applyDelayWithOptionalTyping(content, responses);
        currentNode = getNextNode(
          activeFlow.nodes,
          currentNode.order,
          content.nextNodeOrder,
        );

        if (params.isSimulation) {
          executionTrace.push({
            nodeId: variablesBefore.last_node_id as string || "start",
            type: "logic",
            status: "success",
            variablesBefore,
            variablesAfter: { ...mergedVariables },
            responses: [...responses],
          });
        }
        break;
      }
      case "wait": {
        const waitMs = normalizeDurationMs(content.waitMs ?? content.delayMs);
        await applyDelayWithOptionalTyping(content, responses, waitMs);
        currentNode = getNextNode(
          activeFlow.nodes,
          currentNode.order,
          content.nextNodeOrder,
        );

        if (params.isSimulation) {
          executionTrace.push({
            nodeId: variablesBefore.last_node_id as string || "start",
            type: "logic",
            status: "success",
            variablesBefore,
            variablesAfter: { ...mergedVariables },
            responses: [...responses],
          });
        }
        break;
      }
      case "typing": {
        const typingMs = normalizeDurationMs(content.typingDurationMs, 1000);
        responses.push({ type: "typing", durationMs: typingMs });
        // No server-side wait — dispatch loop handles timing from durationMs
        currentNode = getNextNode(
          activeFlow.nodes,
          currentNode.order,
          content.nextNodeOrder,
        );

        if (params.isSimulation) {
          executionTrace.push({
            nodeId: variablesBefore.last_node_id as string || "start",
            type: "logic",
            status: "success",
            variablesBefore,
            variablesAfter: { ...mergedVariables },
            responses: [...responses],
          });
        }
        break;
      }
      case "end": {
        const resumed = await resumeParentFlow({
          tenantId: params.tenantId,
          runtime,
        });
        if (resumed) {
          activeFlow = resumed.flow;
          currentNode = resumed.node;
          break;
        }

        completed = true;
        currentNode = null;
        break;
      }
      default: {
        currentNode = getNextNode(activeFlow.nodes, currentNode.order);
        break;
      }
    }
  }

  const waitingForInput = Boolean(currentNode && currentNode.type === "input");
  const shouldFallbackToAi = completed && !responses.length;

  runtime.activeFlowId = completed ? runtime.rootFlowId : activeFlow.id;
  setRuntimeState(mergedVariables, runtime);

  if (params.isSimulation) {
    mergedVariables.last_node_id = completed ? null : currentNode?.id || null;
  }

  if (!params.isSimulation) await prisma.flowSession.update({
    where: { id: session.id },
    data: {
      variables: mergedVariables as Prisma.InputJsonValue,
      currentNodeId: completed ? null : currentNode?.id || null,
      isActive: !completed,
      completedAt: completed ? new Date() : null,
    },
  });

  if (!responses.length && activeFlow.fallbackMessage && !shouldFallbackToAi) {
    responses.push({ type: "text", text: activeFlow.fallbackMessage, quickReplies: [] });
  }

  return {
    handled: (responses.length > 0 || completed || waitingForInput) && !shouldFallbackToAi,
    responses,
    flowId: activeFlow.id,
    flowName: activeFlow.name,
    flowSessionId: session.id,
    completed,
    waitingForInput,
    shouldFallbackToAi,
    fallbackMessage: activeFlow.fallbackMessage || null,
    executionTrace: params.isSimulation ? executionTrace : undefined,
    variables: params.isSimulation ? mergedVariables : undefined,
  };
}
