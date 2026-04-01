import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

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

export default withAuth(
  function middleware(req) {
    // Allow all requests - auth check is handled by withAuth
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Allow public routes
        if (isPublicRoute(pathname)) {
          return true;
        }

        // Require token for protected routes
        return !!token;
      },
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
