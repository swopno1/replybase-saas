import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Allow chat routes to be public
  if (pathname.startsWith("/chat/")) {
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
    // otherwise, allow access to the protected route
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
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|_next/data|favicon.ico|image).*)",
  ],
};
