import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { DataDeletionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") as DataDeletionStatus | null;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 25;

  const where = status ? { status } : {};

  const [requests, total] = await Promise.all([
    prisma.dataDeletionRequest.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        status: true,
        source: true,
        confirmationCode: true,
        requestedAt: true,
        scheduledDeletionAt: true,
        processedAt: true,
        notes: true,
        userId: true,
        tenantId: true,
      },
    }),
    prisma.dataDeletionRequest.count({ where }),
  ]);

  return NextResponse.json({ requests, total, page, totalPages: Math.ceil(total / limit) });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isPlatformAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, status, notes } = await req.json();

  if (!id || !status) {
    return NextResponse.json({ error: "id and status are required" }, { status: 400 });
  }

  const updated = await prisma.dataDeletionRequest.update({
    where: { id },
    data: {
      status,
      notes: notes ?? undefined,
      ...(status === DataDeletionStatus.COMPLETED ? { processedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({ ok: true, request: updated });
}
