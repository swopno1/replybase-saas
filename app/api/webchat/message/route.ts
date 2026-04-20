import { NextRequest, NextResponse } from "next/server";

import {
  createWebchatCorsHeaders,
  getWebchatOriginRejectionReason,
  isWebchatOriginAllowed,
} from "@/lib/webchat-cors";

export async function POST(request: NextRequest) {
  return NextResponse.json({
    responses: [
      {
        type: "text",
        text: "Our AI Agent is under development! We'll be up again soon.",
      },
    ],
    meta: { mode: "safe_fallback" },
  });
}

export async function OPTIONS(request: NextRequest) {
  if (!isWebchatOriginAllowed(request)) {
    const reason = getWebchatOriginRejectionReason(request);
    return NextResponse.json(
      { error: "Origin not allowed", reason },
      {
        status: 403,
        headers: createWebchatCorsHeaders(request),
      },
    );
  }

  return new NextResponse(null, {
    status: 204,
    headers: createWebchatCorsHeaders(request),
  });
}
