/**
 * Seed Reusable Subflows: Contact Capture and Human Handoff
 *
 * Creates reusable subflows and business flows that call them.
 *
 * Usage:
 *   npx tsx scripts/seed-reusable-subflows.ts
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type NodeInput = {
  type: string;
  content: Prisma.InputJsonValue;
  order: number;
};

type SeedFlowInput = {
  name: string;
  description: string;
  fallbackMessage: string;
  nodes: NodeInput[];
};

const CONTACT_CAPTURE_NODES: NodeInput[] = [
  {
    type: "message",
    content: {
      text: "I'll need a few details to get you the right support. Let's start with your name.",
    },
    order: 0,
  },
  {
    type: "input",
    content: {
      text: "What's your name?",
      variableName: "contact_name",
      inputType: "text",
    },
    order: 1,
  },
  {
    type: "input",
    content: {
      text: "What's your email address?",
      variableName: "contact_email",
      inputType: "email",
    },
    order: 2,
  },
  {
    type: "input",
    content: {
      text: "Best phone number to reach you?",
      variableName: "contact_phone",
      inputType: "phone",
    },
    order: 3,
  },
  {
    type: "message",
    content: {
      text: "Perfect, {{contact_name}}! I have your info. Thanks for sharing.",
    },
    order: 4,
  },
  {
    type: "action",
    content: {
      actionType: "tag_user",
      tags: ["captured_contact"],
    },
    order: 5,
  },
  {
    type: "end",
    content: {},
    order: 6,
  },
];

const HUMAN_HANDOFF_NODES: NodeInput[] = [
  {
    type: "message",
    content: {
      text: "One moment while I connect you with a member of our team...",
    },
    order: 0,
  },
  {
    type: "action",
    content: {
      actionType: "assign_to_agent",
      assignmentGroup: "support_team",
    },
    order: 1,
  },
  {
    type: "message",
    content: {
      text: "A team member will be with you shortly. They'll continue from here.",
    },
    order: 2,
  },
  {
    type: "end",
    content: {},
    order: 3,
  },
];

const WELCOME_WITH_SUBFLOW_TEMPLATE: NodeInput[] = [
  {
    type: "message",
    content: {
      text: "Welcome. I can help with pricing, support, or bookings.",
    },
    order: 0,
  },
  {
    type: "input",
    content: {
      text: "What would you like help with today?",
      variableName: "welcome_choice",
      inputType: "text",
    },
    order: 1,
  },
  {
    type: "condition",
    content: {
      conditions: [
        {
          variableName: "welcome_choice",
          operator: "contains",
          value: "price",
          nextNodeOrder: 3,
        },
        {
          variableName: "welcome_choice",
          operator: "contains",
          value: "support",
          nextNodeOrder: 6,
        },
        {
          variableName: "welcome_choice",
          operator: "contains",
          value: "book",
          nextNodeOrder: 9,
        },
      ],
      nextNodeOrder: 3,
    },
    order: 2,
  },
  {
    type: "message",
    content: {
      text: "Great. I will collect your details so we can send pricing.",
    },
    order: 3,
  },
  {
    type: "action",
    content: {
      actionType: "call_flow",
      targetFlowName: "Contact Capture",
    },
    order: 4,
  },
  {
    type: "message",
    content: {
      text: "Thanks {{contact_name}}. Our sales team will reach out with pricing options.",
    },
    order: 5,
  },
  {
    type: "message",
    content: {
      text: "Understood. I will capture your details and connect you to support.",
    },
    order: 6,
  },
  {
    type: "action",
    content: {
      actionType: "call_flow",
      targetFlowName: "Contact Capture",
    },
    order: 7,
  },
  {
    type: "action",
    content: {
      actionType: "call_flow",
      targetFlowName: "Human Handoff",
    },
    order: 8,
  },
  {
    type: "message",
    content: {
      text: "Perfect. I will collect your details for booking confirmation.",
    },
    order: 9,
  },
  {
    type: "action",
    content: {
      actionType: "call_flow",
      targetFlowName: "Contact Capture",
    },
    order: 10,
  },
  {
    type: "message",
    content: {
      text: "Thanks. We will confirm availability soon.",
    },
    order: 11,
  },
  {
    type: "end",
    content: {},
    order: 12,
  },
];

const PRICING_WITH_SUBFLOW_TEMPLATE: NodeInput[] = [
  {
    type: "message",
    content: {
      text: "Our pricing is flexible based on your use case.",
    },
    order: 0,
  },
  {
    type: "input",
    content: {
      text: "Are you interested in Starter, Pro, or Enterprise?",
      variableName: "pricing_interest",
      inputType: "text",
    },
    order: 1,
  },
  {
    type: "action",
    content: {
      actionType: "call_flow",
      targetFlowName: "Contact Capture",
    },
    order: 2,
  },
  {
    type: "message",
    content: {
      text: "Thanks {{contact_name}}. A specialist will send exact pricing and setup details.",
    },
    order: 3,
  },
  {
    type: "action",
    content: {
      actionType: "call_flow",
      targetFlowName: "Human Handoff",
    },
    order: 4,
  },
  {
    type: "end",
    content: {},
    order: 5,
  },
];

const SUPPORT_WITH_SUBFLOW_TEMPLATE: NodeInput[] = [
  {
    type: "message",
    content: {
      text: "Support is here. Please tell me what you need help with.",
    },
    order: 0,
  },
  {
    type: "input",
    content: {
      text: "Describe your issue in one line:",
      variableName: "support_issue",
      inputType: "text",
    },
    order: 1,
  },
  {
    type: "action",
    content: {
      actionType: "call_flow",
      targetFlowName: "Contact Capture",
    },
    order: 2,
  },
  {
    type: "action",
    content: {
      actionType: "call_flow",
      targetFlowName: "Human Handoff",
    },
    order: 3,
  },
  {
    type: "end",
    content: {},
    order: 4,
  },
];

function withResolvedFlowIds(
  nodes: NodeInput[],
  flowIdsByName: Record<string, string>,
): NodeInput[] {
  return nodes.map((node) => {
    if (node.type !== "action") return node;

    const content = (node.content || {}) as Record<string, unknown>;
    if (content.actionType !== "call_flow") return node;

    const targetFlowName =
      typeof content.targetFlowName === "string" ? content.targetFlowName : "";

    if (!targetFlowName || !flowIdsByName[targetFlowName]) {
      return node;
    }

    return {
      ...node,
      content: {
        ...content,
        targetFlowId: flowIdsByName[targetFlowName],
      },
    };
  });
}

async function createOrReplaceFlow(
  tenantId: string,
  ownerId: string,
  params: SeedFlowInput,
) {
  const normalizedNodes = params.nodes.map((node) => ({
    type: node.type,
    order: node.order,
    content: JSON.parse(JSON.stringify(node.content)) as Prisma.InputJsonValue,
  }));

  const existing = await prisma.flow.findFirst({
    where: {
      tenantId,
      name: params.name,
      isGlobal: false,
    },
  });

  if (existing) {
    return prisma.flow.update({
      where: { id: existing.id },
      data: {
        description: params.description,
        ownerId,
        isActive: true,
        language: "en",
        fallbackMessage: params.fallbackMessage,
        nodes: {
          deleteMany: {},
          create: normalizedNodes,
        },
      },
      include: {
        nodes: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });
  }

  return prisma.flow.create({
    data: {
      name: params.name,
      description: params.description,
      tenantId,
      ownerId,
      isGlobal: false,
      isActive: true,
      language: "en",
      fallbackMessage: params.fallbackMessage,
      nodes: {
        create: normalizedNodes,
      },
    },
    include: {
      nodes: {
        orderBy: {
          order: "asc",
        },
      },
    },
  });
}

async function seed() {
  try {
    console.log("Starting reusable subflow seeding...\n");

    const seedUser = await prisma.user.findFirst({
      where: {
        tenantId: {
          not: "",
        },
      },
      select: {
        id: true,
        tenantId: true,
        isAdmin: true,
      },
      orderBy: [{ isAdmin: "desc" }, { createdAt: "asc" }],
    });

    if (!seedUser?.tenantId) {
      console.error(
        "No user with a tenant found. Create at least one user and tenant first.",
      );
      process.exit(1);
    }

    const tenantId = seedUser.tenantId;
    console.log(`Using tenant: ${tenantId}\n`);

    const contactCaptureFlow = await createOrReplaceFlow(
      tenantId,
      seedUser.id,
      {
        name: "Contact Capture",
        description:
          "Reusable subflow to collect name, email, and phone from users.",
        fallbackMessage: "Please provide a valid response.",
        nodes: CONTACT_CAPTURE_NODES,
      },
    );
    console.log(`Created/updated: Contact Capture (${contactCaptureFlow.id})`);

    const humanHandoffFlow = await createOrReplaceFlow(tenantId, seedUser.id, {
      name: "Human Handoff",
      description:
        "Reusable subflow to transition conversations to a human agent.",
      fallbackMessage: "I will connect you with a team member.",
      nodes: HUMAN_HANDOFF_NODES,
    });
    console.log(`Created/updated: Human Handoff (${humanHandoffFlow.id})`);

    const flowIdsByName: Record<string, string> = {
      "Contact Capture": contactCaptureFlow.id,
      "Human Handoff": humanHandoffFlow.id,
    };

    const welcomeNodes = withResolvedFlowIds(
      WELCOME_WITH_SUBFLOW_TEMPLATE,
      flowIdsByName,
    );
    const pricingNodes = withResolvedFlowIds(
      PRICING_WITH_SUBFLOW_TEMPLATE,
      flowIdsByName,
    );
    const supportNodes = withResolvedFlowIds(
      SUPPORT_WITH_SUBFLOW_TEMPLATE,
      flowIdsByName,
    );

    const welcomeFlow = await createOrReplaceFlow(tenantId, seedUser.id, {
      name: "Welcome Journey with Subflows",
      description:
        "Welcome flow that reuses Contact Capture and Human Handoff across paths.",
      fallbackMessage: "Please rephrase your request.",
      nodes: welcomeNodes,
    });
    console.log(`Created/updated: Welcome Journey (${welcomeFlow.id})`);

    const pricingFlow = await createOrReplaceFlow(tenantId, seedUser.id, {
      name: "Pricing Journey with Subflows",
      description:
        "Pricing flow that reuses Contact Capture and Human Handoff.",
      fallbackMessage: "Please clarify your pricing question.",
      nodes: pricingNodes,
    });
    console.log(`Created/updated: Pricing Journey (${pricingFlow.id})`);

    const supportFlow = await createOrReplaceFlow(tenantId, seedUser.id, {
      name: "Support Journey with Subflows",
      description:
        "Support flow that reuses Contact Capture and Human Handoff.",
      fallbackMessage: "Please share more details about your issue.",
      nodes: supportNodes,
    });
    console.log(`Created/updated: Support Journey (${supportFlow.id})\n`);

    console.log("Seeding complete.");
    console.log("Summary:");
    console.log(`- Contact Capture: ${contactCaptureFlow.id}`);
    console.log(`- Human Handoff: ${humanHandoffFlow.id}`);
    console.log(`- Welcome Journey: ${welcomeFlow.id}`);
    console.log(`- Pricing Journey: ${pricingFlow.id}`);
    console.log(`- Support Journey: ${supportFlow.id}`);

    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
}

seed();
