import { prisma } from "../lib/prisma";

const SUPPORTED_TYPES = ["web", "facebook", "telegram", "whatsapp"] as const;

async function main() {
  const channels = await prisma.channel.findMany({
    select: { id: true, type: true },
  });

  const updates = channels
    .map((channel) => ({
      id: channel.id,
      originalType: channel.type,
      normalizedType: channel.type.toLowerCase(),
    }))
    .filter((channel) => channel.originalType !== channel.normalizedType)
    .filter((channel) =>
      SUPPORTED_TYPES.includes(
        channel.normalizedType as (typeof SUPPORTED_TYPES)[number],
      ),
    );

  const unsupported = channels
    .map((channel) => ({
      id: channel.id,
      originalType: channel.type,
      normalizedType: channel.type.toLowerCase(),
    }))
    .filter(
      (channel) =>
        !SUPPORTED_TYPES.includes(
          channel.normalizedType as (typeof SUPPORTED_TYPES)[number],
        ),
    );

  for (const update of updates) {
    await prisma.channel.update({
      where: { id: update.id },
      data: {
        type: update.normalizedType as (typeof SUPPORTED_TYPES)[number],
      },
    });
  }

  console.log(
    `[normalize-web-channel-type] Updated ${updates.length} channel rows`,
  );

  if (unsupported.length > 0) {
    console.warn(
      `[normalize-web-channel-type] Found ${unsupported.length} unsupported channel type rows.`,
    );
    for (const row of unsupported.slice(0, 20)) {
      console.warn(
        `[normalize-web-channel-type] Unsupported type ${row.originalType} on channel ${row.id}`,
      );
    }
  }
}

main()
  .catch((error) => {
    console.error("[normalize-web-channel-type] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
