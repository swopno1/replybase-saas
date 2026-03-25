import { NextRequest, NextResponse } from "next/server";
import getOidcProvider from "@/lib/oidc-provider";
import { IncomingMessage, ServerResponse } from "http";
import { headers } from "next/headers";

export const dynamic = 'force-dynamic';




export const runtime = "nodejs";

function toBuffer(chunk: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }

  if (typeof chunk === "string" || chunk instanceof Uint8Array) {
    return Buffer.from(chunk);
  }

  return Buffer.from(String(chunk ?? ""));
}

// Helper to bridge NextRequest to IncomingMessage
async function createIncomingMessage(
  req: NextRequest,
): Promise<IncomingMessage> {
  const headersList = await headers();
  const readable = new IncomingMessage(null as unknown as never);

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
    const { oidc } = await params;
    const pathname = "/" + (oidc?.join("/") || "");
    console.log("[OIDC] Incoming request:", pathname);

    // Handle discovery endpoint directly
    if (pathname === "/.well-known/openid-configuration") {
      console.log("[OIDC] Returning discovery document");
      const ISSUER =
        process.env.NEXT_PUBLIC_APP_URL || "https://app.replybase.co.uk";
      const discoveryDoc = {
        issuer: ISSUER + "/api/oidc",
        authorization_endpoint: ISSUER + "/api/oidc/auth",
        token_endpoint: ISSUER + "/api/oidc/token",
        userinfo_endpoint: ISSUER + "/api/oidc/me",
        jwks_uri: ISSUER + "/api/oidc/jwks",
        scopes_supported: [
          "openid",
          "email",
          "profile",
          "plan",
          "subscription_status",
        ],
        response_types_supported: ["code", "code id_token", "id_token"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        claim_types_supported: ["normal"],
        claims_supported: [
          "sub",
          "email",
          "email_verified",
          "name",
          "plan",
          "subscription_status",
          "iss",
          "aud",
        ],
      };
      return NextResponse.json(discoveryDoc);
    }

    // For all other OIDC endpoints, use the provider callback
    const provider = getOidcProvider();
    console.log("[OIDC] Provider initialized");

    const reqShim = await createIncomingMessage(req);
    reqShim.url = pathname + req.nextUrl.search;
    const resShim = new ServerResponse(reqShim);

    // Promise wrapper to await oidc-provider middleware
    return new Promise<NextResponse>((resolve, reject) => {
      const chunks: Buffer[] = [];

      // Capture data
      resShim.write = (chunk: unknown) => {
        chunks.push(toBuffer(chunk));
        return true;
      };

      resShim.end = (chunk: unknown) => {
        if (chunk) {
          chunks.push(toBuffer(chunk));
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
