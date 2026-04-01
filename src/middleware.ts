import { NextRequest, NextResponse } from 'next/server';

// Portfolio demo — all routes are public, no auth required.
// Login page redirects to dashboard.
export default function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/login' || req.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
