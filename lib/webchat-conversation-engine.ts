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
    // No server-side wait — webchat client handles timing from response array
    void delayMs;
    return;
  }

  const typingDurationMs = delayMs > 0 ? delayMs : MIN_TYPING_DELAY_MS;
  responses.push({ type: "typing", durationMs: typingDurationMs });
  // No server-side wait — webchat client handles timing from durationMs
}

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
  tenantId: string;
  contactId: string;
  flowId: string;
  siteId: string;
  sourceContext: WebchatSourceContext;
  variables: Record<string, unknown>;
  tags?: string[];
  status?: string;
}) {
  const name = getVariableString(params.variables, "lead_name", "name");
  const email = getVariableString(params.variables, "lead_email", "email");
  const phone = getVariableString(
    params.variables,
    "lead_phone",
    "phone",
    "mobile",
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

  if (!name && !email && !phone && !company && !need && !budget) {
    return;
  }

  const contactData = {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };

  if (Object.keys(contactData).length > 0) {
    await prisma.contact.update({
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

  // Collect every user-visible flow variable into flowInputs so the leads
  // table can show one column per captured input.  Internal engine keys are
  // excluded; everything else (including variables already stored as dedicated
  // columns) is preserved here for a complete snapshot.
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
    source: "website",
    status: params.status || existingLead?.status || "contacted",
    tags: mergeTags(existingLead?.tags, params.tags),
    metadata: {
      ...existingMetadata,
      siteId: params.siteId,
      captureSource: "webchat_flow",
      sourceContext: params.sourceContext,
      need,
      budget,
      lastUserMessage: getVariableString(params.variables, "last_user_message"),
      flowInputs: { ...previousFlowInputs, ...newFlowInputs },
    } as Prisma.InputJsonValue,
  };

  if (existingLead) {
    await prisma.lead.update({
      where: { id: existingLead.id },
      data: leadData,
    });
    return;
  }

  await prisma.lead.create({
    data: leadData,
  });
}

// Sessions older than this without activity are considered abandoned and reset.
const STALE_SESSION_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
// No cooldown — flow_Initial's order:-1 returning-user gate handles qualified
// contacts gracefully (skips greeting + lead-gen, goes straight to explore topic).
// Setting this to 0 prevents post-flow messages from falling through to AI/fallback.
// Setting this to 1 hour prevents the flow from restarting immediately after completion.
const FLOW_REPEAT_COOLDOWN_MS = 60 * 60 * 1000; 

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
    const updatedAt = activeSession.updatedAt ? new Date(activeSession.updatedAt) : new Date();
    const updatedAtTime = updatedAt.getTime();
    
    if (!isNaN(updatedAtTime)) {
      const sessionAge = Date.now() - updatedAtTime;
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
          return { flow, session: activeSession, pageId, isNewSession: false };
        }
      } else {
        // Stale session (> 24 h inactive) — expire it so the visitor gets a
        // fresh start.  Contact variables (name, email) will be injected by the
        // caller so the lead-gen gate skips re-interrogating known contacts.
        await prisma.flowSession.update({
          where: { id: activeSession.id },
          data: { isActive: false },
        });
      }
    } else {
      // Fallback for invalid date: deactivate stale session
      await prisma.flowSession.update({
        where: { id: activeSession.id },
        data: { isActive: false },
      });
    }
  }

  // Enforce a 12-hour cooldown before allowing the flow to restart after a
  // successful completion.  This mirrors the behaviour in bot-entry-flow-engine.
  const recentlyCompleted = await prisma.flowSession.findFirst({
    where: {
      userId: params.contactId,
      pageId,
      isActive: false,
      completedAt: { gte: new Date(Date.now() - FLOW_REPEAT_COOLDOWN_MS) },
    },
    orderBy: { completedAt: "desc" },
  });

  if (recentlyCompleted) {
    return null;
  }

  async function startFlowSession(
    flow: NonNullable<Awaited<ReturnType<typeof loadAccessibleFlow>>>,
  ) {
    const session = await prisma.flowSession.create({
      data: {
        userId: params.contactId,
        pageId,
        flowId: flow.id,
        currentNodeId: flow.nodes[0]?.id || null,
        variables: {
          __runtime: createInitialRuntimeState(flow.id),
        },
        isActive: true,
      },
    });

    return { flow, session, pageId, isNewSession: true };
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

import { incrementTenantUsage } from "./subscription";

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

  // Centralized usage tracking for webchat flow executions
  await incrementTenantUsage(
    params.tenantId,
    "flow_execution",
    1,
    params.botId,
    params.channelId || undefined,
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

  const variables = {
    ...((session.variables as Record<string, unknown> | null) || {}),
    ...toFlowVariables(params.sourceContext),
  };

  // Inject contact identity so flow nodes can gate on contact_is_qualified
  // without hitting the DB again.  "true"/"false" strings are used because
  // the condition evaluator compares values as strings.
  const contactRecord = await prisma.contact.findUnique({
    where: { id: params.contactId },
    select: { name: true, email: true, phone: true },
  });
  variables.contact_name = contactRecord?.name ?? "";
  variables.contact_name_prefix = contactRecord?.name
    ? `, ${contactRecord.name}`
    : "";
  variables.contact_email = contactRecord?.email ?? "";
  variables.contact_phone = contactRecord?.phone ?? "";
  variables.contact_is_qualified = contactRecord?.email ? "true" : "false";

  const runtime = getRuntimeState(variables, session.flowId);
  const responses: Array<
    { type: "text"; text: string } | { type: "typing"; durationMs: number }
  > = [];
  let pendingMessage = resolved.isNewSession ? "" : params.message.trim();

  if (pendingMessage) {
    variables.last_user_message = pendingMessage;
    variables.last_user_message_normalized = pendingMessage.toLowerCase();
  }

  let currentNode: (typeof activeFlow.nodes)[number] | null =
    activeFlow.nodes.find((node) => node.id === session.currentNodeId) ||
    activeFlow.nodes[0];
  let completed = false;
  let leadPersisted = false;
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
          variables[variableName] = pendingMessage;
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
          text: interpolateText(prompt, variables),
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
            tenantId: params.tenantId,
            contactId: params.contactId,
            flowId: runtime.rootFlowId,
            siteId: params.siteId,
            sourceContext: params.sourceContext,
            variables,
            tags,
          });
          leadPersisted = true;
        }

        if (content.action === "update_status") {
          await persistLeadCapture({
            tenantId: params.tenantId,
            contactId: params.contactId,
            flowId: runtime.rootFlowId,
            siteId: params.siteId,
            sourceContext: params.sourceContext,
            variables,
            status:
              typeof (content as { status?: unknown }).status === "string"
                ? (content as { status?: string }).status
                : undefined,
          });
          leadPersisted = true;
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
        // No server-side wait — webchat client handles timing from durationMs
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

  if (completed && !leadPersisted) {
    await persistLeadCapture({
      tenantId: params.tenantId,
      contactId: params.contactId,
      flowId: runtime.rootFlowId,
      siteId: params.siteId,
      sourceContext: params.sourceContext,
      variables,
    });
  }

  const waitingForInput = Boolean(currentNode && currentNode.type === "input");
  runtime.activeFlowId = completed ? runtime.rootFlowId : activeFlow.id;
  setRuntimeState(variables, runtime);

  await prisma.flowSession.update({
    where: { id: session.id },
    data: {
      variables: variables as Prisma.InputJsonValue,
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
