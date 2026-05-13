import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "./lib/rate-limit";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- RATE LIMITING & PROTECTION ---
  // 1. Auth Rate Limiting
  if (pathname.startsWith("/api/auth")) {
    const rl = await checkRateLimit(req, "auth");
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }
  }

  // 2. Webhook Rate Limiting
  if (pathname.includes("/webhook")) {
    const rl = await checkRateLimit(req, "webhook");
    if (!rl.allowed) return new NextResponse("Too Many Requests", { status: 429 });
  }

  // 3. Request Size Limits
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  // --- END PROTECTION ---

  const token = await getToken({ req, secret: process.env.AUTH_SECRET });

  // Allow public assets
  if (pathname.includes(".")) {
    return NextResponse.next();
  }

  // Redirect /privacy and /terms to external URLs
  if (pathname === "/privacy") {
    return NextResponse.redirect(new URL("https://replybase.co.uk/privacy", req.url));
  }
  if (pathname === "/terms") {
    return NextResponse.redirect(new URL("https://replybase.co.uk/terms", req.url));
  }

  // Allow chat routes to be public
  if (pathname.startsWith("/chat/")) {
    return NextResponse.next();
  }


  // Allow webhook routes to be public
  if (pathname.startsWith("/api/billing/webhook")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/facebook/webhook")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/telegram/webhook")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/whatsapp/webhook")) {
    return NextResponse.next();
  }

  if (pathname === "/api/telegram/health") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/webchat/")) {
    return NextResponse.next();
  }

  // Newsletter APIs implement their own API key / token validation.
  if (pathname.startsWith("/api/newsletter/")) {
    return NextResponse.next();
  }

  // Allow health and public endpoints to be public
  if (
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/system-health") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron/")
  ) {
    return NextResponse.next();
  }

  const authPaths = ["/auth/login", "/auth/register", "/auth/forgot-password"];
  const isAuthPath = authPaths.includes(pathname);

  const publicPaths = [
    "/pricing",
    "/faq",
    "/webchat-e2e",
    "/data-deletion-status",
    "/data-deletion-request",
    "/newsletter/unsubscribe",
  ];
  const isPublicPath = publicPaths.some(
    (publicPath) =>
      pathname === publicPath || pathname.startsWith(`${publicPath}/`),
  );

  // --- DEFAULT DENY ENFORCEMENT ---
  const isProtectedPath =
    pathname.startsWith("/api/") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/admin") ||
    pathname === "/"; // Root is protected as it's the dashboard redirect

  // Allow explicitly public paths even if they fall under protected prefixes
  if (isPublicPath || isAuthPath) {
    // If logged in and hitting auth path, redirect to home
    if (token && isAuthPath) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // If the user is logged in
  if (token) {
    // SUBSCRIPTION CHECK
    // If not on billing page/pricing and subscription is inactive, redirect to pricing
    const subscriptionStatus = (token.subscriptionStatus as string || "active").toLowerCase();
    const isBillingPath =
      pathname.startsWith("/settings/billing") ||
      pathname.startsWith("/settings/account") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/pricing") ||
      pathname === "/" ||
      pathname.startsWith("/api/");

    const isPageRequest = !pathname.startsWith("/api/");

    if (
      isPageRequest &&
      !isBillingPath &&
      subscriptionStatus !== "active" &&
      subscriptionStatus !== "trialing" &&
      subscriptionStatus !== "free"
    ) {
      const billingUrl = new URL(
        "/pricing?reason=subscription_required",
        req.url,
      );
      return NextResponse.redirect(billingUrl);
    }

    return NextResponse.next();
  }

  // Default Deny for unauthenticated users on protected paths
  if (isProtectedPath) {
    // For protected API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // For protected UI routes, redirect to login
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|_next/data|favicon.ico).*)",
  ],
};
