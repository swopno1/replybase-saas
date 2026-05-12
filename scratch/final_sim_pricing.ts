import { executeBotEntryFlowFirst } from "../lib/bot-entry-flow-engine";
import { prisma } from "../lib/prisma";
import "dotenv/config";

async function simulatePricingClick() {
  const tenantId = "cmox3h0uw000013nwaubo2wm8";
  const botId = "cmox462qc000c14mcq2nar08z";
  
  // 1. Create a fresh contact for a clean test
  const contact = await prisma.contact.create({
    data: {
      tenantId,
      name: "Final Test User",
    }
  });

  console.log(`--- Starting Simulation for Contact: ${contact.id} ---`);

  // 2. Initial Turn (Greeting)
  const welcomeResult = await executeBotEntryFlowFirst({
    tenantId,
    botId,
    contactId: contact.id,
    scopeKey: `sim:${contact.id}`,
    message: "", // Start session
    entryFlow: "cmox462p4000114mck073aic4", // ReplyBase Main Flow
  });

  console.log("\n[Debug Welcome Result]:", JSON.stringify(welcomeResult, null, 2));

  const sessionAfterWelcome = await prisma.flowSession.findUnique({
    where: { id: welcomeResult?.flowSessionId }
  });
  console.log("\n[Debug Session Flow ID]:", sessionAfterWelcome?.flowId);

  // 3. User clicks "See Pricing & ROI" (Payload: INTENT_PRICING)
  console.log("\n[User]: (Clicks 'See Pricing & ROI') -> Sending 'INTENT_PRICING'");

  const pricingResult = await executeBotEntryFlowFirst({
    tenantId,
    botId,
    contactId: contact.id,
    scopeKey: `sim:${contact.id}`,
    message: "price",
    entryFlow: "cmox462p4000114mck073aic4",
  });

  console.log("\n[Debug Pricing Result]:", JSON.stringify(pricingResult, null, 2));

  const sessionAfterPricing = await prisma.flowSession.findUnique({
    where: { id: pricingResult?.flowSessionId }
  });
  console.log("\n[Debug Session Variables after Pricing Call]:", JSON.stringify(sessionAfterPricing?.variables, null, 2));

  console.log("\n[Bot Pricing Response]:");
  pricingResult?.responses.forEach(r => {
    if (r.type === "text") console.log(`> ${r.text}`);
  });

  // Verification
  const lastResponse = pricingResult?.responses[pricingResult.responses.length - 1];
  if (lastResponse?.type === "text" && lastResponse.text.includes("email")) {
    console.log("\n✅ SUCCESS: The bot successfully requested the email immediately!");
  } else {
    console.log("\n❌ FAILURE: The bot did not request the email as expected.");
  }

  // Cleanup
  await prisma.contact.delete({ where: { id: contact.id } });
}

simulatePricingClick();
