'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch (error) {
      console.error('Sign in error:', error);
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#3b8fc2' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (session) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ backgroundColor: '#3b8fc2' }}>
      {/* Floating bubbles to match careers page */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -left-16 top-1/4 w-48 h-48 rounded-full bg-white/10 blur-sm" />
        <div className="absolute left-1/4 top-2/3 w-64 h-64 rounded-full bg-white/8 blur-sm" />
        <div className="absolute right-0 top-1/6 w-40 h-40 rounded-full bg-white/10 blur-sm" />
        <div className="absolute right-1/4 top-1/3 w-32 h-32 rounded-full bg-white/6 blur-sm" />
        <div className="absolute right-12 bottom-1/4 w-56 h-56 rounded-full bg-white/8 blur-sm" />
        <div className="absolute left-1/3 -top-8 w-24 h-24 rounded-full bg-yellow-300/15 blur-sm" />
        <div className="absolute right-1/3 bottom-12 w-20 h-20 rounded-full bg-yellow-300/10 blur-sm" />
      </div>

      <div className="relative z-10 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl p-10 w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <Image
            src="https://placehold.co/280x80/3BA9DA/white?text=Acme+Talent"
            alt="Acme Talent"
            width={280}
            height={80}
            unoptimized
            className="h-16 w-auto object-contain mb-2"
          />
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Hiring Hub</h1>
          <p className="text-sm text-gray-500 mt-1">Applicant tracking & hiring pipeline management</p>
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-[#3b8fc2] text-white rounded-xl shadow-sm hover:bg-[#3480b0] focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-all font-medium mb-3"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Enter Demo
        </button>

        <p className="mt-4 text-center text-xs text-gray-400">
          Portfolio demo — explore the full ATS experience
        </p>
      </div>
    </div>
  );
}
