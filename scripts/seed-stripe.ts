const { PrismaClient } = require('@prisma/client');
const Stripe = require('stripe');
require('dotenv').config();

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-12-15.clover',
});

const PLANS = [
    {
        name: 'free',
        displayName: 'Free',
        price: 0,
        limits: {
            dailyMessageLimit: 100,
            monthlyMessageLimit: 3000,
            flowExecutionCap: 100,
            maxBots: 1,
            maxChannelsPerBot: 1,
            maxConversations: 100,
        },
    },
    {
        name: 'starter',
        displayName: 'Starter',
        price: 1900, // $19.00
        limits: {
            dailyMessageLimit: 1000,
            monthlyMessageLimit: 30000,
            flowExecutionCap: 1000,
            maxBots: 3,
            maxChannelsPerBot: 3,
            maxConversations: 1000,
        },
    },
    {
        name: 'pro',
        displayName: 'Pro',
        price: 4900, // $49.00
        limits: {
            dailyMessageLimit: 5000,
            monthlyMessageLimit: 150000,
            flowExecutionCap: 5000,
            maxBots: 10,
            maxChannelsPerBot: 5,
            maxConversations: 5000,
        },
    },
    {
        name: 'business',
        displayName: 'Business',
        price: 9900, // $99.00
        limits: {
            dailyMessageLimit: 20000,
            monthlyMessageLimit: 600000,
            flowExecutionCap: 20000,
            maxBots: 50,
            maxChannelsPerBot: 10,
            maxConversations: 20000,
        },
    },
];

async function seed() {
    console.log('Seeding Stripe products and plans...');

    for (const plan of PLANS) {
        let priceId = '';

        // skip creating stripe product for free plan usually, unless you want a $0 subscription
        if (plan.price > 0) {
            console.log(`Processing Stripe product for ${plan.displayName}...`);

            // 1. Check if product exists (by name search or metadata)
            const products = await stripe.products.search({
                query: `name:'ReplyBase ${plan.displayName}'`,
            });

            let product = products.data[0];

            if (!product) {
                console.log(`Creating product: ReplyBase ${plan.displayName}`);
                product = await stripe.products.create({
                    name: `ReplyBase ${plan.displayName}`,
                    metadata: {
                        app_plan_id: plan.name,
                    },
                });
            } else {
                console.log(`Product existing: ${product.id}`);
            }

            // 2. Check if price exists
            const prices = await stripe.prices.list({
                product: product.id,
                limit: 1,
                active: true,
            });

            let price = prices.data[0];

            if (!price || price.unit_amount !== plan.price) {
                // Create new price if none exists or amount changed
                // Note: We don't delete old prices programmatically to avoid breaking existing subs
                console.log(`Creating price for ${plan.displayName}: $${plan.price / 100}`);
                price = await stripe.prices.create({
                    product: product.id,
                    unit_amount: plan.price,
                    currency: 'usd',
                    recurring: {
                        interval: 'month',
                    },
                    metadata: {
                        app_plan_id: plan.name,
                    }
                });
            } else {
                console.log(`Price existing: ${price.id}`);
            }

            priceId = price.id;
        }

        // 3. Upsert Plan in Database
        console.log(`Upserting DB Plan: ${plan.name}`);
        await prisma.plan.upsert({
            where: { name: plan.name },
            update: {
                displayName: plan.displayName,
                price: plan.price / 100, // Store as float dollar amount
                currency: 'USD',
                ...plan.limits
                // We could store stripePriceId here if we added it to schema, 
                // but typically we can lookup by Plan name or rely on the frontend 
                // map if we don't want strict DB->Stripe tight coupling on this ID.
                // For now, let's keep it simple.
            },
            create: {
                name: plan.name,
                displayName: plan.displayName,
                price: plan.price / 100,
                currency: 'USD',
                ...plan.limits
            },
        });

        if (priceId) {
            console.log(`--> Use this Price ID for ${plan.name}: ${priceId}`);
        }
    }

    console.log('Seeding complete.');
}

seed()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
