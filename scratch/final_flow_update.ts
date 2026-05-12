import { prisma } from "../lib/prisma";
import "dotenv/config";

async function finalUpdateFlows() {
  const tenantId = "cmox3h0uw000013nwaubo2wm8";

  // 1. Update Pricing Flow
  const pricingFlowId = "cmoyq80kx000csfighds8roff";
  await prisma.flowNode.deleteMany({ where: { flowId: pricingFlowId } });
  
  const pricingNodes = [
    { order: 0, type: "message", content: { text: "I'd love to prepare a tailored ROI breakdown for your setup." } },
    { order: 1, type: "input", content: { text: "Where should I email the breakdown so you don't lose your progress?", inputType: "email", variableName: "lead_email" } },
    { order: 2, type: "action", content: { action: "tag_user", tags: ["lead", "pricing_interest"] } },
    { order: 3, type: "input", content: { text: "Thanks! And what kind of business do you run?", inputType: "text", variableName: "business_type" } },
    { order: 4, type: "input", content: { text: "Got it. Roughly how many inbound messages do you handle monthly?", inputType: "number", variableName: "monthly_volume" } },
    { order: 5, type: "message", content: { text: "Perfect. I'm finalizing your breakdown now. Based on your volume, our Pro Plan is likely your best fit." } },
    { order: 6, type: "message", content: { 
        text: "To ensure you see our reply instantly, I highly recommend syncing this conversation to your phone. Click below to continue on WhatsApp:",
        buttons: [
          { type: "url", title: "📱 Switch to WhatsApp", url: "https://wa.me/447822033580?text=SYNC_{{sync_hash}}" },
          { type: "postback", title: "📅 Book a Demo", payload: "INTENT_BOOKING" }
        ]
      }
    }
  ];

  for (const data of pricingNodes) {
    await prisma.flowNode.create({ data: { flowId: pricingFlowId, type: data.type, order: data.order, content: data.content as any } });
  }

  // 2. Update Demo Flow
  const demoFlow = await prisma.flow.findFirst({ where: { name: "Sub-Flow: Omnichannel Demo" } });
  if (demoFlow) {
    await prisma.flowNode.deleteMany({ where: { flowId: demoFlow.id } });
    const demoNodes = [
      { order: 0, type: "message", content: { text: "The best way to understand ReplyBase is to see it work. Switch to WhatsApp, and I'll remember this entire conversation." } },
      { order: 1, type: "message", content: { 
          text: "Ready to see the magic? Click below to switch to your phone. I'll pick up exactly where we left off.",
          buttons: [
            { type: "url", title: "🟢 Switch to WhatsApp", url: "https://wa.me/447822033580?text=SYNC_{{sync_hash}}" },
            { type: "url", title: "🔵 Switch to Telegram", url: "https://t.me/ReplyBaseBot?start=SYNC_{{sync_hash}}" },
            { type: "postback", title: "💬 Stay here", payload: "STAY_HERE" }
          ]
        }
      }
    ];
    for (const data of demoNodes) {
      await prisma.flowNode.create({ data: { flowId: demoFlow.id, type: data.type, order: data.order, content: data.content as any } });
    }
  }

  console.log("All conversion flows updated with sync_hash and lead-first logic.");
}

finalUpdateFlows();
