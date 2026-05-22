import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const PATCH = withAdmin(async (session, request, context, db) => {
  try {
    const { id } = (await context.params) as { id: string };
    const body = await request.json();
    const { flowId, isActive } = body;

    const channel = await db.channel.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(flowId !== undefined && {
          flowAssignments: {
            upsert: {
              create: {
                flowId: flowId,
                isActive: true,
              },
              update: {
                flowId: flowId,
                isActive: true,
              },
            },
          },
        }),
      },
    });

    return NextResponse.json({ channel });
  } catch (error) {
    console.error("[Admin Channel API] PATCH Error:", error);
    return NextResponse.json(
      { error: "Failed to update channel" },
      { status: 500 },
    );
  }
});
