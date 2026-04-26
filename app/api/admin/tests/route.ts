import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exec } from "child_process";
import { isPlatformAdmin } from "@/lib/admin";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const results = await prisma.testHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(results);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { type, name } = await req.json();

  if (type === "smoke") {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;

      const result = await prisma.testHistory.create({
        data: {
          type: "smoke",
          name: name || "Production Smoke Test",
          status: "passed",
          duration: Date.now() - start,
          output: "DB connectivity check passed.",
        },
      });
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  const allowProductionLoad = process.env.ALLOW_PRODUCTION_LOAD_TESTS === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (type === "load") {
    if (isProduction && !allowProductionLoad) {
        return NextResponse.json({
            error: "Load tests are disabled in production. Set ALLOW_PRODUCTION_LOAD_TESTS=true to enable."
        }, { status: 403 });
    }

    exec(`pnpm tsx scripts/run-load-tests.ts`, (error) => {
        if (error) console.error("Admin triggered load test failed", error);
    });
    return NextResponse.json({ message: "Load test triggered" });
  }

  return new NextResponse("Invalid test type", { status: 400 });
}
