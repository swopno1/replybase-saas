import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';




export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const request = await prisma.dataDeletionRequest.findUnique({
    where: { confirmationCode: code },
  });

  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: request.status,
    requestedAt: request.requestedAt,
    processedAt: request.processedAt,
  });
}
