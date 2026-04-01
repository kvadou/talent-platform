'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function UnauthorizedContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="bg-white/90 backdrop-blur shadow-lg border border-warning-200 rounded-2xl p-8 w-full max-w-md text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h1>
      {error === 'domain' ? (
        <p className="text-gray-600 mb-6">
          Only users with <strong>@acmetalent.com</strong> or <strong>@chessat3.sg</strong> email addresses can access this application.
        </p>
      ) : (
        <p className="text-gray-600 mb-6">
          You do not have permission to access this application.
        </p>
      )}
      <Link
        href="/login"
        className="inline-flex items-center justify-center px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition-colors"
      >
        Sign in with a different account
      </Link>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-gradient-soft p-6">
      <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
        <UnauthorizedContent />
      </Suspense>
    </div>
  );
}
