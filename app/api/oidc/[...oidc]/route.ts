import { NextRequest, NextResponse } from "next/server";
import getOidcProvider from "@/lib/oidc-provider";
import { IncomingMessage, ServerResponse } from "http";
import { headers } from "next/headers";

export const runtime = "nodejs";

// Helper to bridge NextRequest to IncomingMessage
async function createIncomingMessage(
  req: NextRequest,
): Promise<IncomingMessage> {
  const headersList = await headers();
  const readable = new IncomingMessage(null as any);

  readable.method = req.method;
  readable.url = req.nextUrl.pathname + req.nextUrl.search;
  readable.headers = {};

  headersList.forEach((value, key) => {
    readable.headers[key] = value;
  });

  // Body handling (simplified)
  if (req.body) {
    const buffer = await req.arrayBuffer();
    readable.push(Buffer.from(buffer));
    readable.push(null);
  } else {
    readable.push(null);
  }

  return readable;
}

// Handler
async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ oidc: string[] }> },
) {
  try {
    const { oidc } = await params; // Await params
    console.log("[OIDC] Incoming request:", req.nextUrl.pathname);

    const provider = getOidcProvider();
    console.log("[OIDC] Provider initialized");

    const reqShim = await createIncomingMessage(req);
    // Strip the /api/oidc prefix so oidc-provider receives the relative path
    const relativePath = "/" + (oidc?.join("/") || "");
    reqShim.url = relativePath + req.nextUrl.search;
    console.log("[OIDC] Request URL set to:", reqShim.url);

    const resShim = new ServerResponse(reqShim);

    // We need to capture the response from resShim and return NextResponse
    // Typically oidc-provider writes to resShim.

    // Promise wrapper to await oidc-provider middleware
    return new Promise<NextResponse>((resolve, reject) => {
      const chunks: Buffer[] = [];

      // Capture data
      resShim.write = (chunk: any, ...args: any[]) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      };

      resShim.end = (chunk: any, ...args: any[]) => {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const body = Buffer.concat(chunks);
        const responseHeaders = new Headers();

        // Copy headers
        const outgoingKeys = resShim.getHeaderNames();
        for (const key of outgoingKeys) {
          const val = resShim.getHeader(key);
          if (Array.isArray(val)) {
            val.forEach((v) => responseHeaders.append(key, String(v)));
          } else if (val !== undefined) {
            responseHeaders.set(key, String(val));
          }
        }

        resolve(
          new NextResponse(body, {
            status: resShim.statusCode || 200,
            statusText: resShim.statusMessage,
            headers: responseHeaders,
          }),
        );
        return resShim;
      };

      // Execute provider with error handling
      try {
        provider.callback()(reqShim, resShim);
      } catch (error) {
        console.error("[OIDC] Error in provider.callback():", error);
        reject(error);
      }
    }).catch((error) => {
      console.error("[OIDC] Unhandled error in OIDC route:", error);
      return new NextResponse(
        JSON.stringify({
          error: "server_error",
          error_description:
            error instanceof Error ? error.message : "Unknown error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    });
  } catch (error) {
    console.error("[OIDC] Top-level error in handler:", error);
    return new NextResponse(
      JSON.stringify({
        error: "server_error",
        error_description:
          error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export { handler as GET, handler as POST };
