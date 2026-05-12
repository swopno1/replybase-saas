import { prisma } from "../lib/prisma";
import "dotenv/config";

async function updateDemoFlow() {
  const flow = await prisma.flow.findFirst({
    where: { name: "Sub-Flow: Omnichannel Demo" }
  });

  if (!flow) return console.log("Flow not found");

  await prisma.flowNode.deleteMany({ where: { flowId: flow.id } });

  const nodesData = [
    {
      order: 0,
      type: "message",
      content: {
        text: "The best way to understand ReplyBase is to see it work. We are chatting here on the website, but if you switch to WhatsApp, I'll remember this entire conversation."
      }
    },
    {
      order: 1,
      type: "message",
      content: {
        text: "Ready to see the magic? Click below to switch to your phone. I'll pick up exactly where we left off.",
        buttons: [
          {
            type: "url",
            title: "🟢 Switch to WhatsApp",
            url: "https://wa.me/447822033580?text=SYNC_{{session_id}}"
          },
          {
            type: "url",
            title: "🔵 Switch to Telegram",
            url: "https://t.me/ReplyBaseBot?start=SYNC_{{session_id}}"
          },
          {
            type: "postback",
            title: "💬 Stay here",
            payload: "STAY_HERE"
          }
        ]
      }
    }
  ];

  for (const data of nodesData) {
    await prisma.flowNode.create({
      data: {
        flowId: flow.id,
        type: data.type,
        order: data.order,
        content: data.content as any
      }
    });
  }

  console.log("Omnichannel Demo Sub-Flow updated.");
}

updateDemoFlow();
