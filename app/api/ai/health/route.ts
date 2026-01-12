import { NextResponse } from "next/server";

const AI_ENGINE_URL = process.env.AI_ENGINE_URL;
const BOTPRESS_SERVICE_TOKEN = process.env.BOTPRESS_SERVICE_TOKEN;

export async function GET() {
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
    const response = await fetch(`${AI_ENGINE_URL}/api/v1/bots`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${BOTPRESS_SERVICE_TOKEN}`,
      },
      cache: "no-store",
    });

    if (response.status === 200 || response.status === 401) {
      return NextResponse.json({ status: "ok" });
    }

    return NextResponse.json(
      { status: "error", message: "Service unavailable" },
      { status: 503 }
    );
  } catch (error) {
    console.error("[API] AI Engine health check failed:", error);
    return NextResponse.json(
      { status: "error", message: "Service unavailable" },
      { status: 503 }
    );
  }
}
