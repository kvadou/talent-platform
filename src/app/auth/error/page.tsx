'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const getErrorMessage = () => {
    switch (error) {
      case 'Configuration':
        return 'There is a problem with the server configuration.';
      case 'AccessDenied':
        return 'You do not have permission to sign in.';
      case 'Verification':
        return 'The sign in link is no longer valid.';
      default:
        return 'An error occurred during sign in.';
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur shadow-lg border border-danger-200 rounded-2xl p-8 w-full max-w-md text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-danger-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Authentication Error</h1>
      <p className="text-gray-600 mb-6">{getErrorMessage()}</p>
      <Link
        href="/login"
        className="inline-flex items-center justify-center px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition-colors"
      >
        Try again
      </Link>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-gradient-soft p-6">
      <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
        <AuthErrorContent />
      </Suspense>
    </div>
  );
}
