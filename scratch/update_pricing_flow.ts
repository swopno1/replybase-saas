import { prisma } from "../lib/prisma";
import "dotenv/config";

async function updatePricingFlow() {
  const flowId = "cmoyq80kx000csfighds8roff";
  const tenantId = "cmox3h0uw000013nwaubo2wm8";

  // 1. Delete existing nodes
  await prisma.flowNode.deleteMany({ where: { flowId } });

  const nodesData = [
    {
      order: 0,
      type: "message",
      content: {
        text: "I'd love to prepare a tailored ROI breakdown for your setup."
      }
    },
    {
      order: 1,
      type: "input",
      content: {
        text: "Where should I email the breakdown so you don't lose your progress and can review it with your team?",
        inputType: "email",
        variableName: "lead_email"
      }
    },
    {
      order: 2,
      type: "action",
      content: {
        action: "tag_user",
        tags: ["lead", "pricing_interest"]
      }
    },
    {
      order: 3,
      type: "input",
      content: {
        text: "Thanks! And what kind of business do you run? (e.g. Real Estate, SaaS, E-commerce)",
        inputType: "text",
        variableName: "business_type"
      }
    },
    {
      order: 4,
      type: "input",
      content: {
        text: "Got it. Roughly how many inbound messages do you handle monthly across all your channels?",
        inputType: "number",
        variableName: "monthly_volume"
      }
    },
    {
      order: 5,
      type: "message",
      content: {
        text: "Perfect. I'm finalizing your breakdown now. Based on your volume, our Pro Plan is likely your best fit for scaling automation while keeping the human touch."
      }
    },
    {
      order: 6,
      type: "message",
      content: {
        text: "To ensure you see our reply instantly, I highly recommend syncing this conversation to your phone. Click below to continue on WhatsApp:",
        buttons: [
          {
            type: "url",
            title: "📱 Switch to WhatsApp",
            url: "https://wa.me/447822033580?text=SYNC_{{session_id}}"
          },
          {
            type: "postback",
            title: "📅 Book a Demo",
            payload: "INTENT_BOOKING"
          }
        ]
      }
    }
  ];

  for (const data of nodesData) {
    await prisma.flowNode.create({
      data: {
        flowId,
        type: data.type,
        order: data.order,
        content: data.content as any
      }
    });
  }

  console.log("Pricing Sub-Flow updated to High-Speed Lead Capture mode.");
}

updatePricingFlow();
