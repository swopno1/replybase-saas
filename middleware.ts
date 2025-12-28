import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const { pathname } = req.nextUrl

  // Define public routes
  const publicPaths = ['/auth/login', '/auth/register', '/auth/forgot-password']
  const isPublicPath =
    publicPaths.includes(pathname) || pathname.startsWith('/chat/')

  // If the user is trying to access a public path
  if (isPublicPath) {
    if (token) {
      // If the user is logged in, redirect to the dashboard
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    // If the user is not logged in, allow access to the public path
    return NextResponse.next()
  }

  // If the user is trying to access a protected path
  if (!token) {
    // If the user is not logged in, redirect to the login page
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If the user is logged in, allow access to the protected path
  return NextResponse.next()
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
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
