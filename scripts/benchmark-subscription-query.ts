/**
 * Task 053 — Subscription Cache Evaluation
 *
 * Benchmarks the Postgres subscription query used by getTenantLimits to decide
 * whether the Redis L2 cache is worth the ~50 MB RAM it occupies.
 *
 * Decision rule: if p50 latency < 50 ms → remove Redis L2 cache.
 *
 * Usage:
 *   npx tsx scripts/benchmark-subscription-query.ts
 *
 * Requires DATABASE_URL to be set (reads from .env automatically via Prisma).
 */

import { prisma } from "../lib/prisma";

const WARMUP_RUNS = 5;
const SAMPLE_RUNS = 50;

async function measureQuery(tenantId: string): Promise<number> {
  const start = performance.now();
  await prisma.subscription.findFirst({
    where: {
      tenantId,
      status: { in: ["ACTIVE", "TRIALING"] },
    },
    include: { plan: true },
    orderBy: { currentPeriodEnd: "desc" },
  });
  return performance.now() - start;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function main() {
  // Pick the first tenant available in the DB for a realistic query plan.
  const firstSub = await prisma.subscription.findFirst({
    select: { tenantId: true },
  });

  if (!firstSub) {
    console.error("No subscriptions found in the database. Cannot benchmark.");
    process.exit(1);
  }

  const { tenantId } = firstSub;
  console.log(`Benchmarking against tenant: ${tenantId}`);
  console.log(`Warmup: ${WARMUP_RUNS} runs  |  Sample: ${SAMPLE_RUNS} runs\n`);

  // Warmup — lets Postgres cache the query plan and buffer pages.
  for (let i = 0; i < WARMUP_RUNS; i++) {
    await measureQuery(tenantId);
  }

  const samples: number[] = [];
  for (let i = 0; i < SAMPLE_RUNS; i++) {
    samples.push(await measureQuery(tenantId));
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;

  console.log("Results (ms):");
  console.log(`  min  : ${sorted[0].toFixed(2)}`);
  console.log(`  p50  : ${percentile(sorted, 50).toFixed(2)}`);
  console.log(`  p95  : ${percentile(sorted, 95).toFixed(2)}`);
  console.log(`  p99  : ${percentile(sorted, 99).toFixed(2)}`);
  console.log(`  max  : ${sorted[sorted.length - 1].toFixed(2)}`);
  console.log(`  mean : ${mean.toFixed(2)}`);

  const p50 = percentile(sorted, 50);
  const THRESHOLD_MS = 50;

  console.log(`\nThreshold : ${THRESHOLD_MS} ms`);
  if (p50 < THRESHOLD_MS) {
    console.log(
      `✓ p50 (${p50.toFixed(2)} ms) is below ${THRESHOLD_MS} ms — ` +
      `Redis L2 cache is unnecessary. Decision: REMOVE.`
    );
  } else {
    console.log(
      `✗ p50 (${p50.toFixed(2)} ms) exceeds ${THRESHOLD_MS} ms — ` +
      `Redis L2 cache provides measurable benefit. Decision: KEEP.`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
