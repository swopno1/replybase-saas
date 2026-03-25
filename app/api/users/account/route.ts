import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";

export const dynamic = 'force-dynamic';




export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const confirmationCode = `acct_${crypto.randomBytes(12).toString("hex")}`;

    const request = await prisma.dataDeletionRequest.create({
      data: {
        email: session.user.email || "unknown",
        confirmationCode,
        source: "account",
        userId: session.user.id,
        tenantId: session.user.tenantId,
      },
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://app.replybase.co.uk";

    return NextResponse.json({
      success: true,
      confirmationCode: request.confirmationCode,
      statusUrl: `${appUrl}/data-deletion-status?code=${request.confirmationCode}`,
    });
  } catch (error: unknown) {
    console.error("[Account Deletion] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
