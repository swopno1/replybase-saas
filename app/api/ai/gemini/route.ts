import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
// import { checkAiQuota } from "@/lib/ai-quota"; // To be implemented
import { streamText, Output } from "ai";
import { google } from "@ai-sdk/google";

// TODO: Move to env/config
const GEMINI_MODEL = "gemini-pro";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  // Auth check
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Quota check (stub)
  // const quotaOk = await checkAiQuota(session.user.id);
  // if (!quotaOk) {
  //   return NextResponse.json({ error: "AI quota exceeded" }, { status: 429 });
  // }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const messages = body?.messages;
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    // Use the Vercel AI SDK to stream Gemini output
    const aiStream = await streamText({
      model: google(GEMINI_MODEL),
      messages,
      output: Output.text(),
      // Optionally add user/tenant context here
    });

    // Use the SDK's built-in streaming response for Next.js
    return aiStream.toTextStreamResponse({
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Gemini AI error",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
