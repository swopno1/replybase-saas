import { NextResponse } from "next/server";
import {
  converse,
  AiEngineError,
  ConverseInputSchema,
} from "@/lib/ai-engine";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const validation = ConverseInputSchema.safeParse(json);

    if (!validation.success) {
      return NextResponse.json(
        { status: "error", message: "Invalid request body" },
        { status: 400 }
      );
    }

    const { botId, userId, message } = validation.data;
    const responseData = await converse(botId, userId, message);

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
