import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Global middleware for ReplyBase SaaS.
 * Implements a "default-deny" policy for dashboard and non-public API routes.
 */
export default withAuth(
  function middleware(req) {
    // Success - proceed to the requested page/API
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // 1. Define Public Routes (No authentication required)
        const isPublicPage =
          pathname === "/" ||
          pathname.startsWith("/auth") ||
          pathname.startsWith("/data-deletion-status");

        const isPublicApi =
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/health") ||
          pathname.startsWith("/api/webchat") ||
          pathname.startsWith("/api/public") ||
          pathname.startsWith("/api/billing/webhook") ||
          pathname.startsWith("/api/facebook") ||
          pathname.startsWith("/api/telegram") ||
          pathname.startsWith("/api/whatsapp") ||
          pathname.startsWith("/api/newsletter") ||
          pathname.startsWith("/api/data-deletion") ||
          pathname.startsWith("/api/users/password/reset"); // Password reset flow

        const isStaticAsset =
          pathname.startsWith("/_next") ||
          pathname.startsWith("/static") ||
          pathname === "/favicon.ico" ||
          pathname === "/robots.txt" ||
          pathname === "/sitemap.xml" ||
          pathname === "/manifest.json" ||
          pathname === "/site.webmanifest" ||
          pathname.endsWith(".png") ||
          pathname.endsWith(".jpg") ||
          pathname.endsWith(".jpeg") ||
          pathname.endsWith(".svg") ||
          pathname.endsWith(".webp") ||
          pathname.endsWith(".ico") ||
          pathname.endsWith(".js") ||
          pathname.endsWith(".css");

        // Allow access to public routes and static assets
        if (isPublicPage || isPublicApi || isStaticAsset) {
          return true;
        }

        // 2. Define Admin-Only Routes
        if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
          return token?.role === "ADMIN" || token?.role === "SUPERADMIN";
        }

        // 3. Default: Require valid session token for everything else (Dashboard & Protected APIs)
        return !!token;
      },
    },
    pages: {
      signIn: "/auth/login",
    },
  }
);

export const config = {
  // Apply middleware to all routes except specifically excluded ones
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
