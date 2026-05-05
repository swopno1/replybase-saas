import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
  setRuntimeState,
} from "@/lib/flow-runtime-utils";

const MIN_TYPING_DELAY_MS = 300;

async function applyDelayWithOptionalTyping(
  content: FlowNodeContent,
  responses: Array<
    { type: "text"; text: string } | { type: "typing"; durationMs: number }
  >,
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
  tenantId: string;
  contactId: string;
  scopeKey: string;
  channelId?: string;
  entryFlow?: string | null;
}) {
  const activeSession = await prisma.flowSession.findFirst({
    where: {
      userId: params.contactId,
      pageId: params.scopeKey,
      isActive: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (activeSession) {
    const sessionAge = Date.now() - activeSession.updatedAt.getTime();
    if (sessionAge < STALE_SESSION_AGE_MS) {
      // Recent session — resume from where the visitor left off.
      const variables =
        (activeSession.variables as Record<string, unknown>) || {};
      const runtime = getRuntimeState(variables, activeSession.flowId);
      const flow = await loadAccessibleFlow({
        tenantId: params.tenantId,
        flowId: runtime.activeFlowId,
      });

      if (flow) {
        return { flow, session: activeSession, isNewSession: false };
      }
    } else {
      // Stale session (> 24 h inactive) — expire it so the user gets a fresh
      // start.  Contact variables will be injected by the caller.
      await prisma.flowSession.update({
        where: { id: activeSession.id },
        data: { isActive: false },
      });
    }
  }

  // No cooldown — flow_Initial's order:-1 returning-user gate handles qualified
  // contacts gracefully (skips greeting + lead-gen, goes straight to explore topic).
  // Setting this to 0 prevents post-flow messages from falling through to AI/fallback.
  const FLOW_REPEAT_COOLDOWN_MS = 0;
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
    // The lead has already gone through the flow within the last 12 hours — do
    // not restart it.  Return null so the webhook falls through to the AI/fallback.
    return null;
  }

  async function startFlowSession(
    flow: Awaited<ReturnType<typeof loadAccessibleFlow>> extends infer T
      ? NonNullable<T>
      : never,
  ) {
    const session = await prisma.flowSession.create({
      data: {
        userId: params.contactId,
        pageId: params.scopeKey,
        flowId: flow.id,
        currentNodeId: flow.nodes[0]?.id || null,
        variables: {
          __runtime: createInitialRuntimeState(flow.id),
        },
        isActive: true,
      },
    });

    return { flow, session, isNewSession: true };
  }

  if (!params.entryFlow) {
    if (!params.channelId) {
      return null;
    }

    const assignedFlow = await prisma.flowChannelAssignment.findFirst({
      where: {
        channelId: params.channelId,
        isActive: true,
      },
      include: {
        flow: {
          include: {
            nodes: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!assignedFlow || !assignedFlow.flow.isActive) {
      return null;
    }

    return startFlowSession(assignedFlow.flow);
  }

  if (params.channelId) {
    const assignedFlow = await prisma.flowChannelAssignment.findFirst({
      where: {
        channelId: params.channelId,
        isActive: true,
      },
      include: {
        flow: {
          include: {
            nodes: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (assignedFlow?.flow?.isActive) {
      return startFlowSession(assignedFlow.flow);
    }
  }

  const configuredFlow = await prisma.flow.findFirst({
    where: {
      tenantId: params.tenantId,
      isActive: true,
      OR: [{ id: params.entryFlow }, { name: params.entryFlow }],
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

import { incrementTenantUsage } from "./subscription";

export async function executeBotEntryFlowFirst(params: {
  tenantId: string;
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
  await incrementTenantUsage(
    params.tenantId,
    "flow_execution",
    1,
    undefined,
    params.channelId,
  );

  let activeFlow = resolved.flow;
  const { session } = resolved;
  if (!activeFlow.nodes.length) {
    return {
      handled: Boolean(activeFlow.fallbackMessage),
      responses: activeFlow.fallbackMessage
        ? [{ type: "text" as const, text: activeFlow.fallbackMessage }]
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
  const contactRecord = await prisma.contact.findUnique({
    where: { id: params.contactId },
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

  const runtime = getRuntimeState(mergedVariables, session.flowId);
  const responses: Array<
    { type: "text"; text: string } | { type: "typing"; durationMs: number }
  > = [];
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

  while (currentNode && safetyCounter < 30) {
    safetyCounter += 1;
    const content = (currentNode.content || {}) as FlowNodeContent;

    switch (currentNode.type) {
      case "message": {
        const text = content.text
          ? interpolateText(content.text, mergedVariables)
          : "";
        if (text.trim()) {
          responses.push({ type: "text", text: text.trim() });
        }
        await applyDelayWithOptionalTyping(content, responses);
        currentNode = getNextNode(
          activeFlow.nodes,
          currentNode.order,
          content.nextNodeOrder,
        );
        break;
      }
      case "input": {
        const variableName =
          content.variableName || `input_${currentNode.order}`;
        if (pendingMessage) {
          mergedVariables[variableName] = pendingMessage;
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
            if (
              evaluateCondition(
                mergedVariables[condition.variableName] as
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

        await applyDelayWithOptionalTyping(content, responses);
        currentNode = getNextNode(
          activeFlow.nodes,
          currentNode.order,
          content.nextNodeOrder,
        );
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
  runtime.activeFlowId = completed ? runtime.rootFlowId : activeFlow.id;
  setRuntimeState(mergedVariables, runtime);

  await prisma.flowSession.update({
    where: { id: session.id },
    data: {
      variables: mergedVariables as Prisma.InputJsonValue,
      currentNodeId: completed ? null : currentNode?.id || null,
      isActive: !completed,
      completedAt: completed ? new Date() : null,
    },
  });

  if (!responses.length && activeFlow.fallbackMessage) {
    responses.push({ type: "text", text: activeFlow.fallbackMessage });
  }

  return {
    handled: responses.length > 0 || completed || waitingForInput,
    responses,
    flowId: activeFlow.id,
    flowName: activeFlow.name,
    flowSessionId: session.id,
    completed,
    waitingForInput,
    fallbackMessage: activeFlow.fallbackMessage || null,
  };
}
