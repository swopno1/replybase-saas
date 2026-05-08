
import { prisma } from "../lib/prisma";

async function safeMigrate() {
  console.log("🚀 Starting Production-Safe Financial Precision Migration...");

  try {
    await prisma.$transaction(async (tx) => {
      // Migrate Plan.price
      console.log("  Step 1: Migrating Plan prices...");
      await tx.$executeRawUnsafe(`
        ALTER TABLE "plans" ADD COLUMN "price_int" INTEGER DEFAULT 0;
      `);
      await tx.$executeRawUnsafe(`
        UPDATE "plans" SET "price_int" = ROUND("price" * 100)::INTEGER;
      `);
      await tx.$executeRawUnsafe(`
        ALTER TABLE "plans" DROP COLUMN "price";
      `);
      await tx.$executeRawUnsafe(`
        ALTER TABLE "plans" RENAME COLUMN "price_int" TO "price";
      `);

      // Migrate Revenue.amount
      console.log("  Step 2: Migrating Revenue amounts...");
      await tx.$executeRawUnsafe(`
        ALTER TABLE "revenue" ADD COLUMN "amount_int" INTEGER DEFAULT 0;
      `);
      await tx.$executeRawUnsafe(`
        UPDATE "revenue" SET "amount_int" = ROUND("amount" * 100)::INTEGER;
      `);
      await tx.$executeRawUnsafe(`
        ALTER TABLE "revenue" DROP COLUMN "amount";
      `);
      await tx.$executeRawUnsafe(`
        ALTER TABLE "revenue" RENAME COLUMN "amount_int" TO "amount";
      `);
    });

    console.log("✅ Database columns successfully migrated to Integer precision.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Since we already updated the schema in Step 1 of the previous plan,
// the above script is what SHOULD be run in a production CI/CD before the new schema is applied.
// In this sandbox, I will simulate it by ensuring the data logic is sound.

safeMigrate()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
