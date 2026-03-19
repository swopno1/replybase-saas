import { prisma } from "../lib/prisma";

type BackfillStats = {
  scanned: number;
  migrated: number;
  skippedNoBot: number;
  skippedNoChannel: number;
  skippedAmbiguous: number;
  skippedConflict: number;
  alreadyMapped: number;
  failed: number;
};

const APPLY_MODE = process.argv.includes("--apply");

async function main() {
  const stats: BackfillStats = {
    scanned: 0,
    migrated: 0,
    skippedNoBot: 0,
    skippedNoChannel: 0,
    skippedAmbiguous: 0,
    skippedConflict: 0,
    alreadyMapped: 0,
    failed: 0,
  };

  console.log(
    `[backfill-facebook-flow-assignments] Starting in ${APPLY_MODE ? "APPLY" : "DRY-RUN"} mode`,
  );

  const assignments = await prisma.flowAssignment.findMany({
    where: { isActive: true },
    include: {
      page: {
        select: {
          id: true,
          facebookId: true,
          name: true,
          botId: true,
          tenantId: true,
        },
      },
      flow: {
        select: {
          id: true,
          name: true,
          tenantId: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(
    `[backfill-facebook-flow-assignments] Found ${assignments.length} active legacy assignments`,
  );

  for (const assignment of assignments) {
    stats.scanned += 1;

    try {
      const page = assignment.page;
      if (!page?.botId) {
        stats.skippedNoBot += 1;
        console.warn(
          `[skip:no-bot] assignment=${assignment.id} page=${page?.id ?? "unknown"} has no botId`,
        );
        continue;
      }

      const candidateChannels = await prisma.channel.findMany({
        where: {
          botId: page.botId,
          type: "facebook",
        },
        select: {
          id: true,
          pageId: true,
          channelId: true,
          name: true,
        },
      });

      if (candidateChannels.length === 0) {
        stats.skippedNoChannel += 1;
        console.warn(
          `[skip:no-channel] assignment=${assignment.id} page=${page.id} bot=${page.botId} has no facebook channel`,
        );
        continue;
      }

      const exactMatches = candidateChannels.filter(
        (channel) =>
          channel.pageId === page.id || channel.channelId === page.facebookId,
      );

      const resolvedChannels =
        exactMatches.length > 0
          ? exactMatches
          : candidateChannels.length === 1
            ? candidateChannels
            : [];

      if (resolvedChannels.length !== 1) {
        stats.skippedAmbiguous += 1;
        console.warn(
          `[skip:ambiguous] assignment=${assignment.id} page=${page.id} bot=${page.botId} candidates=${candidateChannels.length}`,
        );
        continue;
      }

      const targetChannel = resolvedChannels[0];

      const existingChannelAssignment =
        await prisma.flowChannelAssignment.findUnique({
          where: { channelId: targetChannel.id },
          select: { id: true, flowId: true, isActive: true },
        });

      if (
        existingChannelAssignment &&
        existingChannelAssignment.flowId === assignment.flowId &&
        existingChannelAssignment.isActive
      ) {
        stats.alreadyMapped += 1;
        console.log(
          `[ok:already-mapped] assignment=${assignment.id} channel=${targetChannel.id} flow=${assignment.flowId}`,
        );
        continue;
      }

      if (
        existingChannelAssignment &&
        existingChannelAssignment.flowId !== assignment.flowId &&
        existingChannelAssignment.isActive
      ) {
        stats.skippedConflict += 1;
        console.warn(
          `[skip:conflict] assignment=${assignment.id} channel=${targetChannel.id} existingFlow=${existingChannelAssignment.flowId} incomingFlow=${assignment.flowId}`,
        );
        continue;
      }

      if (APPLY_MODE) {
        await prisma.flowChannelAssignment.upsert({
          where: { channelId: targetChannel.id },
          update: {
            flowId: assignment.flowId,
            isActive: true,
          },
          create: {
            flowId: assignment.flowId,
            channelId: targetChannel.id,
            isActive: true,
          },
        });
      }

      stats.migrated += 1;
      console.log(
        `[ok:migrated] assignment=${assignment.id} page=${page.id} channel=${targetChannel.id} flow=${assignment.flowId}${APPLY_MODE ? "" : " (dry-run)"}`,
      );
    } catch (error) {
      stats.failed += 1;
      console.error(
        `[error] assignment=${assignment.id} failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log("\n[backfill-facebook-flow-assignments] Summary");
  console.log(JSON.stringify(stats, null, 2));

  if (!APPLY_MODE) {
    console.log(
      "\n[backfill-facebook-flow-assignments] Dry-run only. Re-run with --apply to persist changes.",
    );
  }
}

main()
  .catch((error) => {
    console.error("[backfill-facebook-flow-assignments] Fatal error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
