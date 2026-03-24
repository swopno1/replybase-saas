import { prisma } from "@/lib/prisma";

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{
      flow_name: string;
      node_order: number;
      type: string;
      action_type: string | null;
      target_flow_name: string | null;
      target_flow_id: string | null;
    }>
  >`
    SELECT f.name AS flow_name,
           n."order" AS node_order,
           n.type,
           n.content->>'actionType' AS action_type,
           n.content->>'targetFlowName' AS target_flow_name,
           n.content->>'targetFlowId' AS target_flow_id
    FROM flow_nodes n
    JOIN flows f ON f.id = n."flowId"
    WHERE f.name IN (
      'Welcome Journey with Subflows',
      'Pricing Journey with Subflows',
      'Support Journey with Subflows'
    )
      AND n.type = 'action'
    ORDER BY f.name, n."order";
  `;

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
