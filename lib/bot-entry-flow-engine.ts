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
  resolveReferencedFlow,
  resumeParentFlow,
  setRuntimeState,
} from "@/lib/flow-runtime-utils";

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
  const runtime = getRuntimeState(mergedVariables, session.flowId);
  const responses: Array<{ type: "text"; text: string }> = [];
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
