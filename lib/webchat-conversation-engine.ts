import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type WebchatSourceContext = {
  origin: string | null;
  referrer: string | null;
  locale: string | null;
  pageUrl: string | null;
  pageTitle: string | null;
  userAgent: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  firstSeenAt?: string;
  lastSeenAt: string;
};

type FlowWithNodes = Prisma.FlowGetPayload<{
  include: {
    nodes: {
      orderBy: {
        order: "asc";
      };
    };
  };
}>;

type FlowSessionRecord = Prisma.FlowSessionGetPayload<{}>;

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

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeOrigin(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

function getUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function getUtmValue(
  explicitValue: unknown,
  urlLike: string | null,
  key: string,
) {
  const directValue = getString(explicitValue);
  if (directValue) {
    return directValue;
  }

  if (!urlLike) {
    return null;
  }

  try {
    return new URL(urlLike).searchParams.get(key);
  } catch {
    return null;
  }
}

export function buildWebchatSourceContext(params: {
  requestOrigin?: string | null;
  requestReferer?: string | null;
  sessionMetadata?: Record<string, unknown> | null;
  messageMetadata?: Record<string, unknown> | null;
  existingMetadata?: Record<string, unknown> | null;
}) {
  const existingSource =
    params.existingMetadata &&
    typeof params.existingMetadata.webchatSource === "object" &&
    !Array.isArray(params.existingMetadata.webchatSource)
      ? (params.existingMetadata.webchatSource as Record<string, unknown>)
      : null;

  const pageUrl =
    getUrl(
      getString(params.messageMetadata?.pageUrl) ||
        getString(params.messageMetadata?.url),
    ) ||
    getUrl(
      getString(params.sessionMetadata?.pageUrl) ||
        getString(params.sessionMetadata?.url),
    ) ||
    getUrl(getString(existingSource?.pageUrl)) ||
    null;

  const referrer =
    getUrl(getString(params.messageMetadata?.referrer)) ||
    getUrl(params.requestReferer || null) ||
    getUrl(getString(params.sessionMetadata?.referrer)) ||
    getUrl(getString(existingSource?.referrer)) ||
    null;

  const origin =
    normalizeOrigin(getString(params.messageMetadata?.origin)) ||
    normalizeOrigin(params.requestOrigin || null) ||
    normalizeOrigin(getString(params.sessionMetadata?.origin)) ||
    normalizeOrigin(getString(existingSource?.origin)) ||
    (pageUrl ? normalizeOrigin(pageUrl) : null);

  const lastSeenAt = new Date().toISOString();

  return {
    origin,
    referrer,
    locale:
      getString(params.messageMetadata?.locale) ||
      getString(params.sessionMetadata?.locale) ||
      getString(existingSource?.locale),
    pageUrl,
    pageTitle:
      getString(params.messageMetadata?.pageTitle) ||
      getString(params.sessionMetadata?.pageTitle) ||
      getString(existingSource?.pageTitle),
    userAgent:
      getString(params.messageMetadata?.userAgent) ||
      getString(params.sessionMetadata?.userAgent) ||
      getString(existingSource?.userAgent),
    utmSource:
      getUtmValue(params.messageMetadata?.utmSource, pageUrl, "utm_source") ||
      getString(existingSource?.utmSource),
    utmMedium:
      getUtmValue(params.messageMetadata?.utmMedium, pageUrl, "utm_medium") ||
      getString(existingSource?.utmMedium),
    utmCampaign:
      getUtmValue(
        params.messageMetadata?.utmCampaign,
        pageUrl,
        "utm_campaign",
      ) || getString(existingSource?.utmCampaign),
    utmTerm:
      getUtmValue(params.messageMetadata?.utmTerm, pageUrl, "utm_term") ||
      getString(existingSource?.utmTerm),
    utmContent:
      getUtmValue(params.messageMetadata?.utmContent, pageUrl, "utm_content") ||
      getString(existingSource?.utmContent),
    firstSeenAt:
      getString(existingSource?.firstSeenAt) ||
      getString(params.sessionMetadata?.firstSeenAt) ||
      lastSeenAt,
    lastSeenAt,
  } satisfies WebchatSourceContext;
}

export function mergeConversationMetadata(params: {
  existingMetadata?: Record<string, unknown> | null;
  siteId: string;
  channelId: string;
  sourceContext: WebchatSourceContext;
}) {
  return {
    ...(params.existingMetadata || {}),
    siteId: params.siteId,
    channelId: params.channelId,
    webchatSource: params.sourceContext,
  } as Prisma.InputJsonValue;
}

function toFlowVariables(sourceContext: WebchatSourceContext) {
  return {
    locale: sourceContext.locale,
    pageUrl: sourceContext.pageUrl,
    pageTitle: sourceContext.pageTitle,
    referrer: sourceContext.referrer,
    origin: sourceContext.origin,
    utmSource: sourceContext.utmSource,
    utmMedium: sourceContext.utmMedium,
    utmCampaign: sourceContext.utmCampaign,
    utmTerm: sourceContext.utmTerm,
    utmContent: sourceContext.utmContent,
  } as Record<string, string | null>;
}

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
  botId: string;
  contactId: string;
  siteId: string;
  channelId?: string | null;
  entryFlow?: string | null;
}) {
  const pageId = `web:${params.siteId}`;
  const activeSession = await prisma.flowSession.findFirst({
    where: {
      userId: params.contactId,
      pageId,
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
      return { flow, session: activeSession, pageId };
    }
  }

  async function startFlowSession(flow: FlowWithNodes) {
    const session = await prisma.flowSession.create({
      data: {
        userId: params.contactId,
        pageId,
        flowId: flow.id,
        currentNodeId: flow.nodes[0]?.id || null,
        variables: {},
        isActive: true,
      },
    });

    return { flow, session, pageId };
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

  if (!params.entryFlow) {
    return null;
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

export async function executeWebchatFlowFirst(params: {
  tenantId: string;
  botId: string;
  contactId: string;
  siteId: string;
  message: string;
  channelId?: string | null;
  entryFlow?: string | null;
  sourceContext: WebchatSourceContext;
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

  const variables = {
    ...((session.variables as Record<string, unknown> | null) || {}),
    ...toFlowVariables(params.sourceContext),
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
          ? interpolateText(content.text, variables)
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
          variables[variableName] = pendingMessage;
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
          text: interpolateText(prompt, variables),
        });
        currentNode = currentNode;
        safetyCounter = 99;
        break;
      }
      case "condition": {
        let nextNode = null;
        if (content.conditions) {
          for (const condition of content.conditions) {
            if (
              evaluateCondition(
                variables[condition.variableName] as
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
      variables: variables as Prisma.InputJsonValue,
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
