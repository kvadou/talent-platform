import { withAuth } from 'next-auth/middleware';
import { NextRequest, NextResponse } from 'next/server';

const DEMO_MODE = process.env.DEMO_MODE === 'true';

// Routes that don't require authentication
const publicRoutes = [
  '/api/public',
  '/api/assets',
  '/api/health',
  '/api/upload/resume',
  '/api/parse/resume',
  '/api/webhooks',
  '/api/auth',
  '/login',
  '/auth',
  '/careers',
  '/status',
  '/schedule',
  '/reschedule',
  '/availability',
  '/meet',
  '/api/meet',
];

function isPublicRoute(pathname: string): boolean {
  // Root path is public
  if (pathname === '/') return true;

  // Job application pages are public
  if (pathname.match(/^\/jobs\/[^/]+\/apply/)) return true;

  // Check against public route prefixes
  return publicRoutes.some((route) => pathname.startsWith(route));
}

function demoMiddleware(req: NextRequest) {
  // In demo mode, redirect /login to /dashboard
  if (req.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  return NextResponse.next();
}

const authMiddleware = withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        if (isPublicRoute(pathname)) return true;
        return !!token;
      },
    },
    pages: {
      signIn: '/login',
    },
  }
);

export default DEMO_MODE ? demoMiddleware : authMiddleware;

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
