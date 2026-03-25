import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/ai-engine";

export const dynamic = 'force-dynamic';

export async function GET() {
  const healthStatus = await checkHealth();
  if (healthStatus.engine === "down") {
    return NextResponse.json(healthStatus, { status: 503 });
  }
  return NextResponse.json(healthStatus);
}
