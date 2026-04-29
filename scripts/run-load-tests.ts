import { prisma } from "../lib/prisma";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

async function runLoadTest(name: string, scriptPath: string) {
  console.log(`Starting load test: ${name}...`);
  const resultsDir = path.join(process.cwd(), "test-results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
  }

  const reportPath = path.join(resultsDir, `load-report-${Date.now()}.json`);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    // Expect k6 to be in the PATH
    console.log(`Executing: k6 run --summary-export=${reportPath} -e BASE_URL=${baseUrl} ${scriptPath}`);
    execSync(`k6 run --summary-export=${reportPath} -e BASE_URL=${baseUrl} ${scriptPath}`, { stdio: 'inherit' });

    if (fs.existsSync(reportPath)) {
      const summary = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

      const metrics = {
        p50: summary.metrics.http_req_duration?.values['p(50)'] || 0,
        p95: summary.metrics.http_req_duration?.values['p(95)'] || 0,
        p99: summary.metrics.http_req_duration?.values['p(99)'] || 0,
        throughput: summary.metrics.http_reqs?.values.rate || 0,
        errorRate: summary.metrics.http_req_failed?.values.rate || 0,
        totalRequests: summary.metrics.http_reqs?.values.count || 0,
      };

      await prisma.testHistory.create({
        data: {
          type: "load",
          name: name,
          status: metrics.errorRate < 0.05 ? "passed" : "failed",
          duration: Math.round(summary.metrics.iteration_duration?.values.avg || 0),
          metrics: metrics,
          output: `Load test ${name} completed with ${metrics.totalRequests} requests. Error rate: ${(metrics.errorRate * 100).toFixed(2)}%.`,
          metadata: {
            k6_version: summary.root_group?.name || "unknown",
            baseUrl: baseUrl
          }
        }
      });

      console.log(`Load test ${name} finished and results saved.`);
    }
  } catch (error) {
    console.error(`Load test ${name} failed:`, error);
    try {
        await prisma.testHistory.create({
          data: {
            type: "load",
            name: name,
            status: "error",
            duration: 0,
            output: String(error),
          }
        });
    } catch (dbError) {
        console.error("Failed to save error to DB:", dbError);
    }
  }
}

// Check if k6 is installed
try {
    execSync('k6 version');
    const script = process.argv[2] || "load-tests/webchat-load.js";
    const name = process.argv[3] || "Webchat Load Test";
    runLoadTest(name, script);
} catch (e) {
    console.error("k6 is not installed. Please install k6 to run load tests.");
    // If we are in production, we should probably exit with error if k6 is expected
    const isProduction = process.env.NODE_ENV === "production";
    process.exit(isProduction ? 1 : 0);
}
