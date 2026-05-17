const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Querying live database for user replybase1@gmail.com...');
  
  // Find User by email
  const user = await prisma.user.findUnique({
    where: { email: 'replybase1@gmail.com' },
    include: {
      tenant: {
        include: {
          flows: {
            include: {
              nodes: {
                orderBy: { order: 'asc' }
              },
              channelAssignments: {
                include: {
                  channel: true
                }
              },
              assignments: {
                include: {
                  page: true
                }
              }
            }
          },
          bots: true,
          channels: true
        }
      }
    }
  });

  if (!user) {
    console.log('User replybase1@gmail.com not found in database.');
    return;
  }

  console.log('User Details:');
  console.log(`- ID: ${user.id}`);
  console.log(`- Name: ${user.name}`);
  console.log(`- Role: ${user.role}`);
  console.log(`- Tenant: ${user.tenant.name} (${user.tenant.id})`);
  console.log(`- Total Flows for Tenant: ${user.tenant.flows.length}`);
  
  if (user.tenant.flows.length === 0) {
    console.log('No flows found for this tenant.');
  } else {
    for (const flow of user.tenant.flows) {
      console.log('\n=========================================');
      console.log(`Flow: ${flow.name} (ID: ${flow.id})`);
      console.log(`Description: ${flow.description || 'None'}`);
      console.log(`Active: ${flow.isActive}`);
      console.log(`Version: ${flow.version}`);
      console.log(`Global: ${flow.isGlobal}`);
      console.log(`Nodes count: ${flow.nodes.length}`);
      
      console.log('Channel Assignments:');
      if (flow.channelAssignments.length === 0) {
        console.log('  None');
      } else {
        flow.channelAssignments.forEach(ca => {
          console.log(`  - Channel ID: ${ca.channelId}, Type: ${ca.channel?.type || 'Unknown'}, Active: ${ca.isActive}`);
        });
      }

      console.log('Facebook Page Assignments:');
      if (flow.assignments.length === 0) {
        console.log('  None');
      } else {
        flow.assignments.forEach(a => {
          console.log(`  - Page ID: ${a.pageId}, Name: ${a.page?.name || 'Unknown'}, Active: ${a.isActive}`);
        });
      }

      console.log('Flow Nodes:');
      flow.nodes.forEach(node => {
        console.log(`  [Order ${node.order}] ID: ${node.id}, Type: ${node.type}`);
        console.log(`  Content: ${JSON.stringify(node.content, null, 2).split('\n').map(l => '    ' + l).join('\n')}`);
      });
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
