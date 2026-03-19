import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type FlowWithNodes = Prisma.FlowGetPayload<{
  include: {
    nodes: {
      orderBy: {
        order: "asc";
      };
    };
  };
}>;

type FlowNodeContent = {
  text?: string;
  inputType?: "text" | "email" | "phone" | "number";
  variableName?: string;
  validationMessage?: string;
  conditions?: Array<{
    variableName: string;
    operator: "equals" | "contains" | "greater_than" | "less_than";
    value: string;
    nextNodeOrder?: number;
  }>;
  action?: "tag_user" | "update_status" | "send_email" | "end_flow";
  nextNodeOrder?: number;
};

function interpolateText(text: string, variables: Record<string, unknown>) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = variables[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function getNextNode(
  nodes: FlowWithNodes["nodes"],
  currentOrder: number,
  explicitNextOrder?: number | null,
) {
  const targetOrder = explicitNextOrder ?? currentOrder + 1;
  return nodes.find((node) => node.order === targetOrder) || null;
}

function evaluateCondition(
  value: string | number | boolean | null | undefined,
  operator: string,
  compareValue: string,
) {
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
    const flow = await prisma.flow.findFirst({
      where: {
        id: activeSession.flowId,
        tenantId: params.tenantId,
        isActive: true,
      },
      include: {
        nodes: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (flow) {
      return { flow, session: activeSession };
    }
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

    const session = await prisma.flowSession.create({
      data: {
        userId: params.contactId,
        pageId: params.scopeKey,
        flowId: assignedFlow.flow.id,
        currentNodeId: assignedFlow.flow.nodes[0]?.id || null,
        variables: {},
        isActive: true,
      },
    });

    return { flow: assignedFlow.flow, session };
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

    if (assignedFlow && assignedFlow.flow.isActive) {
      const session = await prisma.flowSession.create({
        data: {
          userId: params.contactId,
          pageId: params.scopeKey,
          flowId: assignedFlow.flow.id,
          currentNodeId: assignedFlow.flow.nodes[0]?.id || null,
          variables: {},
          isActive: true,
        },
      });

      return { flow: assignedFlow.flow, session };
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

  const session = await prisma.flowSession.create({
    data: {
      userId: params.contactId,
      pageId: params.scopeKey,
      flowId: configuredFlow.id,
      currentNodeId: configuredFlow.nodes[0]?.id || null,
      variables: {},
      isActive: true,
    },
  });

  return { flow: configuredFlow, session };
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

  const { flow, session } = resolved;
  if (!flow.nodes.length) {
    return {
      handled: Boolean(flow.fallbackMessage),
      responses: flow.fallbackMessage
        ? [{ type: "text" as const, text: flow.fallbackMessage }]
        : [],
      flowId: flow.id,
      flowName: flow.name,
      flowSessionId: session.id,
      completed: true,
      fallbackMessage: flow.fallbackMessage || null,
    };
  }

  const mergedVariables = {
    ...((session.variables as Record<string, unknown> | null) || {}),
    ...(params.variables || {}),
  };

  const responses: Array<{ type: "text"; text: string }> = [];
  let pendingMessage = params.message.trim();
  let currentNode: (typeof flow.nodes)[number] | null =
    flow.nodes.find((node) => node.id === session.currentNodeId) ||
    flow.nodes[0];
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
          flow.nodes,
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
            flow.nodes,
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
                flow.nodes,
                currentNode.order,
                condition.nextNodeOrder,
              );
              break;
            }
          }
        }
        currentNode =
          nextNode ||
          getNextNode(flow.nodes, currentNode.order, content.nextNodeOrder);
        break;
      }
      case "action": {
        if (content.action === "end_flow") {
          completed = true;
          currentNode = null;
          break;
        }
        currentNode = getNextNode(
          flow.nodes,
          currentNode.order,
          content.nextNodeOrder,
        );
        break;
      }
      case "end": {
        completed = true;
        currentNode = null;
        break;
      }
      default: {
        currentNode = getNextNode(flow.nodes, currentNode.order);
        break;
      }
    }
  }

  const waitingForInput = Boolean(currentNode && currentNode.type === "input");

  await prisma.flowSession.update({
    where: { id: session.id },
    data: {
      variables: mergedVariables as Prisma.InputJsonValue,
      currentNodeId: completed ? null : currentNode?.id || null,
      isActive: !completed,
      completedAt: completed ? new Date() : null,
    },
  });

  if (!responses.length && flow.fallbackMessage) {
    responses.push({ type: "text", text: flow.fallbackMessage });
  }

  return {
    handled: responses.length > 0 || completed || waitingForInput,
    responses,
    flowId: flow.id,
    flowName: flow.name,
    flowSessionId: session.id,
    completed,
    waitingForInput,
    fallbackMessage: flow.fallbackMessage || null,
  };
}
