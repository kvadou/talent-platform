'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

export function ResumeViewer({ url }: { url?: string | null }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  if (!url) {
    return (
      <Card>
        <CardHeader title="Resume" />
        <CardContent>
          <p className="text-sm text-gray-600">No resume uploaded.</p>
        </CardContent>
      </Card>
    );
  }

  const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;

  return (
    <>
      <Card>
        <CardHeader title="Resume" />
        <CardContent>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => setIsModalOpen(true)}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Resume
              </Button>
              <a href={url} download className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resume Modal */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-4xl h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Resume
              </Dialog.Title>
              <div className="flex items-center gap-2">
                <a
                  href={url}
                  download
                  className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-all"
                  title="Download"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                </a>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-all"
                  title="Close"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body - iframe with Google Docs Viewer */}
            <div className="flex-1 relative bg-gray-100">
              {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-warning-500 mx-auto mb-3"></div>
                    <p className="text-sm text-gray-600">Loading resume...</p>
                  </div>
                </div>
              )}
              <iframe
                src={googleViewerUrl}
                className="w-full h-full border-0"
                title="Resume Viewer"
                onLoad={() => setIframeLoaded(true)}
              />
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}
