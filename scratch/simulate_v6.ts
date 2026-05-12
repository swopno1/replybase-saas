/**
 * ReplyBase V6 - Production Simulation Suite (FIXED)
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
    name: "Scenario 1: Pricing → Lead Capture → Discovery",
    contactName: "Alice Chen",
    turns: [
      { label: "Initial Visit", message: "" },
      { label: "Clicks 'See Pricing & ROI'", message: "INTENT_PRICING" },
      { label: "Provides email", message: "alice@example.com" },
      { label: "Provides business type", message: "Real Estate" },
      { label: "Provides volume", message: "500" },
    ],
  },
  {
    name: "Scenario 2: Demo → Lead Capture",
    contactName: "Bob Smith",
    turns: [
      { label: "Initial Visit", message: "" },
      { label: "Clicks 'See Live Demo'", message: "INTENT_DEMO" },
      { label: "Provides email", message: "bob@startup.io" },
    ],
  },
  {
    name: "Scenario 3: Natural Language → Pricing",
    contactName: "Eve Martinez",
    turns: [
      { label: "Initial Visit", message: "" },
      { label: "Types keyword", message: "How much does it cost?" },
      { label: "Provides email", message: "eve@clinic.org" },
    ],
  },
];

async function runScenario(scenario: SimScenario): Promise<{ passed: boolean; log: string[] }> {
  const log: string[] = [];
  log.push(`\n${"=".repeat(70)}`);
  log.push(`📋 ${scenario.name}`);
  log.push(`${"=".repeat(70)}`);

  // Create test contact
  const contact = await prisma.contact.create({
    data: { tenantId: TENANT_ID, name: scenario.contactName }
  });
  log.push(`👤 Contact: ${scenario.contactName} (${contact.id})`);

  let emailCaptured = false;
  let flowSessionId: string | null = null;

  for (const turn of scenario.turns) {
    log.push(`\n  ── Turn: ${turn.label} ──`);
    log.push(`  📤 User: "${turn.message || "(session start)"}"`);

    const result = await executeBotEntryFlowFirst({
      tenantId: TENANT_ID,
      botId: BOT_ID,
      contactId: contact.id,
      scopeKey: `sim_v6:${contact.id}`,
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
    
    flowSessionId = result?.flowSessionId || flowSessionId;
    log.push(`     [handled=${result?.handled}, completed=${result?.completed}]`);
  }

  // Check CRM for updates
  const updatedContact = await prisma.contact.findUnique({
    where: { id: contact.id }
  });

  const leads = await prisma.lead.findMany({
    where: { contactId: contact.id }
  });

  log.push(`\n  ── Final CRM State ──`);
  log.push(`  📧 Contact Email: ${updatedContact?.email || "❌ NOT CAPTURED"}`);
  log.push(`  🏷️  Contact Tags: ${JSON.stringify((updatedContact as any)?.tags || [])}`);
  log.push(`  📊 Lead Records: ${leads.length}`);
  
  if (leads.length > 0) {
    log.push(`     → Latest Lead Tags: ${JSON.stringify((leads[0] as any).tags || [])}`);
  }

  const passed = !!updatedContact?.email;
  log.push(`\n  🏆 VERDICT: ${passed ? "✅ PASS" : "❌ FAIL"}`);

  // Cleanup
  await prisma.contact.delete({ where: { id: contact.id } }).catch(() => {});

  return { passed, log };
}

async function main() {
  console.log("=== ReplyBase V6 Verification Suite ===");
  
  for (const scenario of SCENARIOS) {
    const { log } = await runScenario(scenario);
    log.forEach(l => console.log(l));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
