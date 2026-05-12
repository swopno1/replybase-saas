import { executeBotEntryFlowFirst } from "../lib/bot-entry-flow-engine";
import { prisma } from "../lib/prisma";
import "dotenv/config";

async function simulateOneTurn() {
  const tenantId = "cmox3h0uw000013nwaubo2wm8";
  const botId = "cmox462qc000c14mcq2nar08z";
  
  const contact = await prisma.contact.create({
    data: { tenantId, name: "One Turn Test" }
  });

  console.log(`--- Starting One-Turn Simulation for Contact: ${contact.id} ---`);

  const result = await executeBotEntryFlowFirst({
    tenantId,
    botId,
    contactId: contact.id,
    scopeKey: `sim:${contact.id}`,
    message: "INTENT_PRICING",
    entryFlow: "cmox462p4000114mck073aic4",
  });

  console.log("\n[Responses]:");
  result?.responses.forEach(r => {
    if (r.type === "text") console.log(`- ${r.text}`);
  });

  await prisma.contact.delete({ where: { id: contact.id } });
}

simulateOneTurn();
