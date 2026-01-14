import { NextRequest, NextResponse } from "next/server";
import { converse, AiEngineError, ConverseInputSchema } from "@/lib/ai-engine";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const POST = withAuthAndTenant(
  async ({ tenantId, id: userId }, request, context) => {
    try {
      const json = await request.json();
      const validation = ConverseInputSchema.safeParse({
        ...json,
        tenantId,
        userId,
      });

      if (!validation.success) {
        return NextResponse.json(
          {
            status: "error",
            message: "Invalid request body",
            details: validation.error.issues,
          },
          { status: 400 }
        );
      }

      const responseData = await converse(validation.data);

      return NextResponse.json(responseData);
    } catch (error) {
      if (error instanceof AiEngineError) {
        return NextResponse.json(
          { status: "error", message: error.message },
          { status: 503 }
        );
      }

      console.error("[API] Unhandled error in converse endpoint:", error);
      return NextResponse.json(
        { status: "error", message: "An internal error occurred" },
        { status: 500 }
      );
    }
  }
);
