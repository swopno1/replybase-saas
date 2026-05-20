import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type FlowWithOrderedNodes = Prisma.FlowGetPayload<{
  include: {
    nodes: {
      orderBy: {
        order: "asc";
      };
    };
  };
}>;

export type FlowCondition = {
  variableName: string;
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: string;
  nextNodeOrder?: number;
};

export type FlowButton = {
  type: "postback" | "url";
  title: string;
  payload?: string;
  url?: string;
};

export type FlowNodeContent = {
  text?: string;
  quick_replies?: Array<{ title: string; payload: string; image_url?: string }>;
  buttons?: FlowButton[];
  inputType?: "text" | "email" | "phone" | "number";
  variableName?: string;
  validationMessage?: string;
  conditions?: FlowCondition[];
  action?:
    | "tag_user"
    | "update_status"
    | "send_email"
    | "call_flow"
    | "end_flow"
    | "booking"
    | "checkout"
    | "schedule"
    | "trigger_webhook";
  tags?: string[];
  status?: string;
  targetFlowId?: string;
  targetFlowName?: string;
  bookingService?: string;
  checkoutUrl?: string;
  scheduleLink?: string;
  delayMs?: number;
  waitMs?: number;
  typingDurationMs?: number;
  typingEnabled?: boolean;
  nextNodeOrder?: number;
};

export function normalizeDurationMs(value: unknown, fallback = 0, max = 5000) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(value), 0), max);
}

export async function waitForFlowDurationMs(durationMs: number) {
  if (durationMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, durationMs));
}

export type FlowRuntimeState = {
  rootFlowId: string;
  activeFlowId: string;
  callStack: Array<{
    flowId: string;
    nextNodeOrder: number;
  }>;
};

export function interpolateText(
  text: string,
  variables: Record<string, unknown>,
): string {
  return text.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expression) => {
    const [keysPart, ...filters] = expression.split('|').map((s: string) => s.trim());
    const keys = keysPart.split('||').map((s: string) => s.trim());
    
    let value: unknown = "";
    for (const key of keys) {
      if (variables[key] !== undefined && variables[key] !== null && variables[key] !== "") {
        value = variables[key];
        break;
      }
    }
    
    let strValue = String(value);
    if (filters.includes('urlencode')) {
      strValue = encodeURIComponent(strValue);
    }
    return strValue;
  });
}

/**
 * Formats markdown links and bold styling for non-markdown channels (like WhatsApp and Facebook Messenger).
 * - Conversions:
 *   - `[Title](Url)` -> `Title: Url`
 *   - `**bold**` -> `*bold*` (for WhatsApp if specified) or simply `bold` (for general clean text)
 */
export function formatTextForNonMarkdownChannels(
  text: string,
  options: { boldToken: string } = { boldToken: "" },
): string {
  if (!text) return "";

  // 1. Convert markdown links: [Title](Url) -> Title: Url
  let cleaned = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, (_, title, url) => {
    return `${title}: ${url}`;
  });

  // 2. Convert bold markers: **bold** -> specified bold token (e.g. * for WhatsApp, empty string for FB)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, (_, boldText) => {
    return options.boldToken ? `${options.boldToken}${boldText}${options.boldToken}` : boldText;
  });

  return cleaned;
}

export function sanitizeNameInput(text: string): string {
  if (!text) return "";
  let cleaned = text.trim();

  // 1. Remove introductory conversational greetings/prefixes (case-insensitive)
  const prefixes = [
    /^(?:my\s+name\s+is|i\s+am|this\s+is|i'm)\s+/i,
    /^(?:hey|hi|hello|yo)\s+(?:there|here)?\s*,\s*(?:i'm|i\s+am|this\s+is)\s+/i,
    /^(?:hey|hi|hello|yo)\s+(?:there|here)?\s+(?:i'm|i\s+am|this\s+is)\s+/i,
    /^(?:hey|hi|hello|yo)\s*,\s*(?:i'm|i\s+am)\s+/i,
    /^(?:hey|hi|hello|yo)\s+(?:there|here)?\s+/i,
    /^(?:hey|hi|hello|yo)\s*,\s*/i
  ];

  for (const pattern of prefixes) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, "").trim();
    }
  }

  // 2. Strip trailing punctuation
  cleaned = cleaned.replace(/[.!,;?]+$/, "").trim();

  // 3. Normalize capitalization (e.g., "alex vance" -> "Alex Vance")
  if (cleaned.length > 0 && cleaned.length < 50) {
    return cleaned
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  return text.trim();
}


export function getNextNode(
  nodes: FlowWithOrderedNodes["nodes"],
  currentOrder: number,
  explicitNextOrder?: number | null,
) {
  const targetOrder = explicitNextOrder ?? currentOrder + 1;
  return nodes.find((node) => node.order === targetOrder) || null;
}

export function getNodeByOrder(
  nodes: FlowWithOrderedNodes["nodes"],
  order?: number | null,
) {
  if (order === null || order === undefined) {
    return null;
  }

  return nodes.find((node) => node.order === order) || null;
}

export function evaluateCondition(
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

export function getRuntimeState(
  variables: Record<string, unknown>,
  fallbackFlowId: string,
): FlowRuntimeState {
  const runtime =
    typeof variables.__runtime === "object" &&
    variables.__runtime !== null &&
    !Array.isArray(variables.__runtime)
      ? (variables.__runtime as Partial<FlowRuntimeState>)
      : null;

  return {
    rootFlowId: runtime?.rootFlowId || fallbackFlowId,
    activeFlowId: runtime?.activeFlowId || fallbackFlowId,
    callStack: Array.isArray(runtime?.callStack) ? runtime.callStack : [],
  };
}

export function setRuntimeState(
  variables: Record<string, unknown>,
  runtime: FlowRuntimeState,
) {
  variables.__runtime = runtime;
}

export function createInitialRuntimeState(flowId: string): FlowRuntimeState {
  return {
    rootFlowId: flowId,
    activeFlowId: flowId,
    callStack: [],
  };
}

export async function loadAccessibleFlow(params: {
  tenantId: string;
  flowId: string;
}) {
  return prisma.flow.findFirst({
    where: {
      id: params.flowId,
      OR: [{ tenantId: params.tenantId }, { isGlobal: true }],
    },
    include: {
      nodes: {
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function resolveReferencedFlow(params: {
  tenantId: string;
  targetFlowId?: string;
  targetFlowName?: string;
}) {
  if (!params.targetFlowId && !params.targetFlowName) {
    return null;
  }

  return prisma.flow.findFirst({
    where: {
      OR: [{ tenantId: params.tenantId }, { isGlobal: true }],
      ...(params.targetFlowId
        ? { id: params.targetFlowId }
        : { name: params.targetFlowName }),
    },
    include: {
      nodes: {
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function resumeParentFlow(params: {
  tenantId: string;
  runtime: FlowRuntimeState;
}) {
  const parentFrame = params.runtime.callStack.pop();
  if (!parentFrame) {
    return null;
  }

  const parentFlow = await loadAccessibleFlow({
    tenantId: params.tenantId,
    flowId: parentFrame.flowId,
  });
  if (!parentFlow) {
    return null;
  }

  params.runtime.activeFlowId = parentFlow.id;

  return {
    flow: parentFlow,
    node: getNodeByOrder(parentFlow.nodes, parentFrame.nextNodeOrder),
  };
}
