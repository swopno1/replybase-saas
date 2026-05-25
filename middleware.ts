import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    // Admin path protection
    if (pathname.startsWith("/admin") && token?.role !== "SUPERADMIN" && !token?.isAdmin) {
      return NextResponse.redirect(new URL("/conversations", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // --- PUBLIC PATHS (No Auth Required) ---
        const publicPaths = [
          "/auth/login",
          "/auth/register",
          "/auth/forgot-password",
          "/auth/reset-password",
          "/api/auth",
          "/api/webchat", // Webchat widget endpoints are public (protected by CORS/tokens internally)
          "/api/facebook/webhook",
          "/api/whatsapp/webhook",
          "/api/telegram/webhook",
          "/api/billing/webhook",
          "/api/public/leads",
          "/api/health",
          "/api/system-health",
          "/data-deletion-status",
          "/api/data-deletion",
        ];

        if (publicPaths.some(path => pathname.startsWith(path))) {
          return true;
        }

        // --- PROTECTED PATHS (Require Auth) ---
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public assets)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.png|robots.txt|sitemap.xml|public).*)",
  ],
};
