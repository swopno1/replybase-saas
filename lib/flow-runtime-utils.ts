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

export type FlowNodeContent = {
  text?: string;
  inputType?: "text" | "email" | "phone" | "number";
  variableName?: string;
  validationMessage?: string;
  conditions?: FlowCondition[];
  action?:
    | "tag_user"
    | "update_status"
    | "send_email"
    | "call_flow"
    | "end_flow";
  targetFlowId?: string;
  targetFlowName?: string;
  nextNodeOrder?: number;
};

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
) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = variables[key];
    return value === undefined || value === null ? "" : String(value);
  });
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
