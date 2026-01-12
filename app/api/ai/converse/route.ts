import { NextResponse } from "next/server";

const AI_ENGINE_URL = process.env.AI_ENGINE_URL;
const BOTPRESS_SERVICE_TOKEN = process.env.BOTPRESS_SERVICE_TOKEN;

export async function POST(req: Request) {
  if (!AI_ENGINE_URL || !BOTPRESS_SERVICE_TOKEN) {
    console.error(
      "[API] AI Engine URL or Botpress Service Token is not configured."
    );
    return NextResponse.json(
      { status: "error", message: "Service unavailable" },
      { status: 503 }
    );
  }

  try {
    const { botId, message, userId } = await req.json();

    if (!botId || !message || !userId) {
      return NextResponse.json(
        { status: "error", message: "Missing required fields" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${AI_ENGINE_URL}/api/v1/bots/${botId}/converse/${userId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BOTPRESS_SERVICE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "text", text: message }),
      }
    );

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[API] AI Engine converse request failed:", error);
    return NextResponse.json(
      { status: "error", message: "Service unavailable" },
      { status: 503 }
    );
  }
}
