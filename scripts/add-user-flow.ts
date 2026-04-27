/**
 * Add a new flow for a specific user's tenant.
 * Can be created from a template or a simple welcome flow.
 *
 * Usage:
 *   pnpm tsx scripts/add-user-flow.ts --email=user@example.com --template=restaurant
 *   pnpm tsx scripts/add-user-flow.ts --id=USER_ID --name="Custom Flow"
 *
 * Available templates:
 *   welcome, lead-generation, lead-capture, real-estate, services, agencies, booking,
 *   boutique-gym, personal-training, crossfit-gym, boot-camp, yoga-studio, hair-salon,
 *   barbershop, day-spa, nail-salon, cleaning-services, landscaping, handyman, pet-care,
 *   care-services, restaurant, hotel, golf-club
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getAvailableTemplates, FlowTemplateCategory } from "@/lib/flow-templates";
import minimist from "minimist";
import { Prisma } from "@prisma/client";

async function main() {
  const args = minimist(process.argv.slice(2));
  const email = args.email;
  const id = args.id;
  const templateKey = args.template;
  const customName = args.name;

  if (!email && !id) {
    console.error("Usage: pnpm tsx scripts/add-user-flow.ts --email=user@example.com [--template=category] [--name='Flow Name']");
    process.exit(1);
  }

  try {
    const user = await prisma.user.findFirst({
      where: email ? { email } : { id },
      select: { id: true, tenantId: true, email: true },
    });

    if (!user) {
      console.error(`❌ User not found with ${email ? "email: " + email : "id: " + id}`);
      process.exit(1);
    }

    let flowName = customName || "New Flow";
    let flowDescription = "A new conversational flow.";
    let nodes: any[] = [];

    if (templateKey) {
      const templates = getAvailableTemplates();
      const template = templates.find(t => t.category === templateKey);

      if (!template) {
        console.error(`❌ Template '${templateKey}' not found.`);
        console.log("Available categories:", templates.map(t => t.category).join(", "));
        process.exit(1);
      }

      flowName = customName || template.name;
      flowDescription = template.description;
      nodes = template.nodes;
      console.log(`📝 Using template: ${template.name}`);
    } else {
      // Default simple flow if no template provided
      nodes = [
        {
          type: "message",
          content: { text: "Hello! How can I help you today?" },
          order: 0
        },
        {
          type: "input",
          content: { text: "What's your name?", variableName: "name", inputType: "text" },
          order: 1
        },
        {
          type: "message",
          content: { text: "Nice to meet you, {{name}}!" },
          order: 2
        }
      ];
    }

    const flow = await prisma.flow.create({
      data: {
        name: flowName,
        description: flowDescription,
        tenantId: user.tenantId,
        ownerId: user.id,
        isActive: true,
        nodes: {
          create: nodes.map(n => ({
            type: n.type,
            content: n.content as Prisma.InputJsonValue,
            order: n.order
          }))
        }
      }
    });

    console.log(`✅ Flow created successfully: ${flow.name} (${flow.id})`);
    console.log(`🔗 Assigned to tenant: ${user.tenantId}`);

  } catch (error) {
    console.error("❌ Error adding flow:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
