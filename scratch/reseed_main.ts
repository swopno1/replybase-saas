import { prisma } from "../lib/prisma";
import "dotenv/config";

async function reseedMainFlow() {
  const flowId = "cmox462p4000114mck073aic4";
  const tenantId = "cmox3h0uw000013nwaubo2wm8";

  await prisma.flowNode.deleteMany({ where: { flowId } });

  const nodes = [
    {
      order: 0,
      type: "message",
      content: {
        text: "👋 Hey — welcome to ReplyBase. We automate customer conversations across Webchat, Messenger, and WhatsApp without losing the human touch.\n\nWhat's your main goal today?",
        buttons: [
          { type: "postback", title: "📊 See Pricing & ROI", payload: "INTENT_PRICING" },
          { type: "postback", title: "📱 See Live Demo", payload: "INTENT_DEMO" },
          { type: "postback", title: "📅 Book a Walkthrough", payload: "INTENT_BOOKING" },
          { type: "postback", title: "🚀 Start Free Trial", payload: "INTENT_CHECKOUT" }
        ],
        variableName: "user_intent"
      }
    },
    {
      order: 1,
      type: "condition",
      content: {
        variableName: "user_intent",
        conditions: [
          { value: "PRICING", operator: "contains", nextNodeOrder: 2 },
          { value: "DEMO", operator: "contains", nextNodeOrder: 3 },
          { value: "BOOK", operator: "contains", nextNodeOrder: 4 },
          { value: "TRIAL", operator: "contains", nextNodeOrder: 6 },
          { value: "CHECKOUT", operator: "contains", nextNodeOrder: 6 }
        ],
        nextNodeOrder: 5
      }
    },
    { order: 2, type: "action", content: { action: "call_flow", targetFlowId: "cmoyq80kx000csfighds8roff" } },
    { order: 3, type: "action", content: { action: "call_flow", targetFlowId: "cmoyq9vhx000msfigwcxz4b3g" } },
    { order: 4, type: "action", content: { action: "call_flow", targetFlowId: "cmoyqb5kc000qsfigve3nue6h" } },
    { order: 5, type: "action", content: { action: "end_flow", description: "Handover to AI" } },
    { order: 6, type: "action", content: { action: "call_flow", targetFlowId: "cmoyqc0jj000wsfig2dnzh7uk" } }
  ];

  for (const data of nodes) {
    await prisma.flowNode.create({
      data: {
        flowId,
        type: data.type,
        order: data.order,
        content: data.content as any
      }
    });
  }

  console.log("Main Flow re-seeded with clean logic and explicit variable mapping.");
}

reseedMainFlow();
