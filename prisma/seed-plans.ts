/**
 * Seed script to create default subscription plans
 * Run with: npx tsx prisma/seed-plans.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding subscription plans...');

  const plans = [
    {
      id: 'plan_free',
      name: 'free',
      displayName: 'Free',
      price: 0,
      currency: 'USD',
      dailyMessageLimit: 100,
      monthlyMessageLimit: 1000,
      flowExecutionCap: 50,
      maxBots: 1,
      maxChannelsPerBot: 1,
      features: {
        basicFlows: true,
        facebookIntegration: true,
        activityLogs: true,
        executionLogs: false,
        prioritySupport: false,
      },
    },
    {
      id: 'plan_starter',
      name: 'starter',
      displayName: 'Starter',
      price: 29,
      currency: 'USD',
      dailyMessageLimit: 500,
      monthlyMessageLimit: 10000,
      flowExecutionCap: 200,
      maxBots: 3,
      maxChannelsPerBot: 2,
      features: {
        basicFlows: true,
        facebookIntegration: true,
        whatsappIntegration: true,
        activityLogs: true,
        executionLogs: true,
        prioritySupport: false,
      },
    },
    {
      id: 'plan_pro',
      name: 'pro',
      displayName: 'Pro',
      price: 99,
      currency: 'USD',
      dailyMessageLimit: 2000,
      monthlyMessageLimit: 50000,
      flowExecutionCap: 1000,
      maxBots: 10,
      maxChannelsPerBot: 5,
      features: {
        basicFlows: true,
        advancedFlows: true,
        facebookIntegration: true,
        whatsappIntegration: true,
        webIntegration: true,
        activityLogs: true,
        executionLogs: true,
        prioritySupport: true,
      },
    },
    {
      id: 'plan_enterprise',
      name: 'enterprise',
      displayName: 'Enterprise',
      price: 499,
      currency: 'USD',
      dailyMessageLimit: 10000,
      monthlyMessageLimit: 300000,
      flowExecutionCap: 5000,
      maxBots: 100,
      maxChannelsPerBot: 10,
      features: {
        basicFlows: true,
        advancedFlows: true,
        customFlows: true,
        facebookIntegration: true,
        whatsappIntegration: true,
        webIntegration: true,
        activityLogs: true,
        executionLogs: true,
        prioritySupport: true,
        dedicatedSupport: true,
        customIntegrations: true,
      },
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
    console.log(`✓ Upserted plan: ${plan.displayName}`);
  }

  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding plans:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

