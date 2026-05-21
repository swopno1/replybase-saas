import "dotenv/config";
import { prisma } from "../lib/prisma";
import { executeWebchatFlowFirst, buildWebchatSourceContext } from "../lib/webchat-conversation-engine";
import { leadService } from "../lib/services/lead-service";

const TENANT_ID = "cmox3h0uw000013nwaubo2wm8";
const BOT_ID = "cmox462qc000c14mcq2nar08z";

async function main() {
  console.log("=== REPRODUCING WEBCHAT EMAIL LOOP ===");

  // 1. Create a clean test contact
  const contact = await prisma.contact.create({
    data: {
      tenantId: TENANT_ID,
      name: "Test Visitor",
    },
  });
  console.log(`Created Contact: ${contact.id}`);

  // 2. Create a conversation
  const conversation = await prisma.crmConversation.create({
    data: {
      tenantId: TENANT_ID,
      contactId: contact.id,
      status: "OPEN",
      channel: "webchat",
      metadata: {
        siteId: "test-site",
      },
    },
  });
  console.log(`Created Conversation: ${conversation.id}`);

  const turns = [
    { text: "Hello", label: "Greeting / Flow Start" },
    { text: "Amir Hossain", label: "Provide Name" },
    { text: "amirhossain.limon@gmail.com", label: "Provide Email first time" },
    { text: "No, edit email", label: "Click Edit Email postback" },
    { text: "amirhossain.limon@gmail.com", label: "Provide Email second time" },
  ];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    console.log(`\n--------------------------------------------`);
    console.log(`Turn ${i + 1}: ${turn.label}`);
    console.log(`User Sent: "${turn.text}"`);

    // In the message API, lead extraction runs first:
    await leadService.extractAndSyncLeadDataFromMessage(TENANT_ID, contact.id, turn.text);

    // Fetch the updated contact email to see if it got synced
    const currentContact = await prisma.contact.findUnique({
      where: { id: contact.id },
      select: { email: true },
    });
    console.log(`Contact Email in DB: ${currentContact?.email || "(none)"}`);

    // Run the flow engine
    const result = await executeWebchatFlowFirst({
      tenantId: TENANT_ID,
      botId: BOT_ID,
      contactId: contact.id,
      siteId: "test-site",
      message: turn.text,
      channelId: "cmox71u7v000414r76q7e9x82",
      sourceContext: buildWebchatSourceContext({}),
    });

    console.log(`Flow Result Handled: ${result?.handled}`);
    if (result) {
      console.log(`Responses:`, JSON.stringify(result.responses, null, 2));
      console.log(`Flow Session ID: ${result.flowSessionId}`);
    } else {
      console.log(`Result is null (not handled by flow)`);
    }

    // Check variables in FlowSession
    if (result?.flowSessionId) {
      const session = await prisma.flowSession.findUnique({
        where: { id: result.flowSessionId },
      });
      console.log(`Session Variables:`, JSON.stringify(session?.variables, null, 2));
      console.log(`Session Current Node: ${session?.currentNodeId}`);
      console.log(`Session Active: ${session?.isActive}`);
    }
  }

  // Cleanup
  console.log(`\nCleaning up...`);
  await prisma.crmConversation.delete({ where: { id: conversation.id } }).catch(console.error);
  await prisma.contact.delete({ where: { id: contact.id } }).catch(console.error);
  console.log("Cleanup done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
