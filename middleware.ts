import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Allow public assets
  if (pathname.includes(".")) {
    return NextResponse.next();
  }

  // Allow chat routes to be public
  if (pathname.startsWith("/chat/")) {
    return NextResponse.next();
  }

  // Allow webhook routes to be public
  if (pathname.startsWith("/api/billing/webhook")) {
    return NextResponse.next();
  }

  // Allow OIDC discovery and health endpoints to be public
  if (
    pathname.startsWith("/api/oidc") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/system-health") ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  const authPaths = ["/auth/login", "/auth/register", "/auth/forgot-password"];
  const isAuthPath = authPaths.includes(pathname);

  // If the user is logged in
  if (token) {
    // and tries to access an auth path, redirect to root
    if (isAuthPath) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // SUBSCRIPTION CHECK
    // If not on billing page/pricing and subscription is inactive, redirect to pricing
    const subscriptionStatus = token.subscriptionStatus as string;
    const isBillingPath =
      pathname.startsWith("/settings/billing") ||
      pathname.startsWith("/pricing") ||
      pathname === "/" ||
      pathname.startsWith("/api/");

    // We allow access to "/" (dashboard root usually)?
    // Usually root is dashboard. Let's redirect dashboard access if inactive.
    // We must allow API routes generally, OR specific API routes for billing.
    // Simplification: only block UI pages.
    const isPageRequest = !pathname.startsWith("/api/");

    if (
      isPageRequest &&
      !isBillingPath &&
      subscriptionStatus !== "active" &&
      subscriptionStatus !== "trialing"
    ) {
      const billingUrl = new URL(
        "/pricing?reason=subscription_required",
        req.url,
      );
      return NextResponse.redirect(billingUrl);
    }

    return NextResponse.next();
  }

  // If the user is not logged in
  if (!token) {
    // and tries to access an auth path, allow them
    if (isAuthPath) {
      return NextResponse.next();
    }
    // and tries to access a protected route, redirect to login
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
