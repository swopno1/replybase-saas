import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  const { pathname } = req.nextUrl

  // Routes accessible only to logged-out users
  const authRoutes = ['/login', '/register'];

  // Protected routes prefix
  const protectedPrefix = '/dashboard';

  const isProtectedRoute = pathname.startsWith(protectedPrefix);

  if (!token && isProtectedRoute) {
    // User is not logged in and is trying to access a protected route, redirect to login
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname) // Optionally, redirect back after login
    return NextResponse.redirect(loginUrl)
  }

  if (token && authRoutes.includes(pathname)) {
    // User is logged in and is trying to access login/register, redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

// Configure which routes the middleware runs on
export const config = {
    matcher: [
        '/dashboard/:path*',
        '/login',
        '/register',
    ]
}
