import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DataDeletionStatus } from "@prisma/client";
import { APP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Cancel token is required" }, { status: 400 });
  }

  const request = await prisma.dataDeletionRequest.findUnique({
    where: { cancelToken: token },
  });

  if (!request) {
    return NextResponse.redirect(
      new URL("/data-deletion-status?error=invalid_token", APP_CONFIG.meta.url),
    );
  }

  if (request.status === DataDeletionStatus.COMPLETED) {
    return NextResponse.redirect(
      new URL(
        `/data-deletion-status?code=${request.confirmationCode}&error=already_processed`,
        APP_CONFIG.meta.url,
      ),
    );
  }

  if (
    request.status === DataDeletionStatus.CANCELLED ||
    request.status === DataDeletionStatus.ERROR
  ) {
    return NextResponse.redirect(
      new URL(`/data-deletion-status?code=${request.confirmationCode}`, APP_CONFIG.meta.url),
    );
  }

  await prisma.dataDeletionRequest.update({
    where: { id: request.id },
    data: { status: DataDeletionStatus.CANCELLED },
  });

  return NextResponse.redirect(
    new URL(`/data-deletion-status?code=${request.confirmationCode}`, APP_CONFIG.meta.url),
  );
}
