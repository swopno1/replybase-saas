/**
 * ReplyBase V6 - Production Simulation Suite (EXTENDED)
 */
import { executeBotEntryFlowFirst } from "../lib/bot-entry-flow-engine";
import { prisma } from "../lib/prisma";
import "dotenv/config";

const TENANT_ID = "cmox3h0uw000013nwaubo2wm8";
const BOT_ID = "cmox462qc000c14mcq2nar08z";
const MAIN_FLOW_ID = "cmox462p4000114mck073aic4";

interface SimTurn {
  label: string;
  message: string;
}

interface SimScenario {
  name: string;
  contactName: string;
  turns: SimTurn[];
}

const SCENARIOS: SimScenario[] = [
  {
    name: "Scenario 4: Booking Path",
    contactName: "Carol Davis",
    turns: [
      { label: "Initial Visit", message: "" },
      { label: "Clicks 'Book a Walkthrough'", message: "INTENT_BOOKING" },
      { label: "Provides email", message: "carol@agency.com" },
    ],
  },
  {
    name: "Scenario 5: Checkout/Trial Path",
    contactName: "Dave Wilson",
    turns: [
      { label: "Initial Visit", message: "" },
      { label: "Clicks 'Start Free Trial'", message: "INTENT_CHECKOUT" },
      { label: "Provides email", message: "dave@ecommerce.co" },
    ],
  },
];

async function runScenario(scenario: SimScenario): Promise<{ passed: boolean; log: string[] }> {
  const log: string[] = [];
  log.push(`\n  ── Scenario: ${scenario.name} ──`);

  const contact = await prisma.contact.create({
    data: { tenantId: TENANT_ID, name: scenario.contactName }
  });

  for (const turn of scenario.turns) {
    const result = await executeBotEntryFlowFirst({
      tenantId: TENANT_ID,
      botId: BOT_ID,
      contactId: contact.id,
      scopeKey: `sim_v6_ext:${contact.id}`,
      message: turn.message,
      entryFlow: MAIN_FLOW_ID,
    });

    if (result?.responses) {
      for (const r of result.responses) {
        if (r.type === "text") {
          log.push(`  🤖 Bot: ${r.text}`);
        }
      }
    }
  }

  const updatedContact = await prisma.contact.findUnique({
    where: { id: contact.id }
  });

  const leads = await prisma.lead.findMany({
    where: { contactId: contact.id }
  });

  log.push(`  📧 Email: ${updatedContact?.email || "❌"}`);
  log.push(`  📊 Leads: ${leads.length} (${JSON.stringify((leads[0] as any)?.tags || [])})`);

  const passed = !!updatedContact?.email && leads.length > 0;
  log.push(`  🏆 Result: ${passed ? "✅ PASS" : "❌ FAIL"}`);

  await prisma.contact.delete({ where: { id: contact.id } }).catch(() => {});

  return { passed, log };
}

async function main() {
  console.log("=== Extended Verification ===");
  for (const scenario of SCENARIOS) {
    const { log } = await runScenario(scenario);
    log.forEach(l => console.log(l));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
