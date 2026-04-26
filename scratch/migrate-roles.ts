import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🚀 Starting data migration: isAdmin -> role");

  // 1. Update all users where isAdmin is true to ADMIN role
  const adminUpdate = await prisma.user.updateMany({
    where: {
      isAdmin: true,
    },
    data: {
      role: "ADMIN",
    },
  });
  console.log(`✅ Updated ${adminUpdate.count} users to ADMIN role.`);

  // 2. Update all users where isAdmin is false to USER role 
  // (Optional if default is already USER, but good for consistency)
  const userUpdate = await prisma.user.updateMany({
    where: {
      isAdmin: false,
    },
    data: {
      role: "USER",
    },
  });
  console.log(`✅ Updated ${userUpdate.count} users to USER role.`);

  // 3. Ensure the very first user (or a specific email) is SUPERADMIN if needed
  // This is a safety measure for the main platform owner.
  const firstUser = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (firstUser) {
    await prisma.user.update({
      where: { id: firstUser.id },
      data: { role: "SUPERADMIN" },
    });
    console.log(`👑 Promoted ${firstUser.email} to SUPERADMIN.`);
  }

  console.log("✨ Migration completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
