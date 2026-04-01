'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type ClipData = {
  title: string;
  startTime: number;
  endTime: number;
  duration: number;
  audioUrl: string | null;
  candidateName: string;
  jobTitle: string;
  interviewType: string;
  sharedBy: string;
  createdAt: string;
};

export default function ClipPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [clip, setClip] = useState<ClipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/public/clips/${shareToken}`)
      .then((res) => {
        if (!res.ok) throw new Error('Clip not found');
        return res.json();
      })
      .then((data) => {
        setClip(data);
        setLoading(false);
      })
      .catch(() => {
        setError('This clip is no longer available or the link is invalid.');
        setLoading(false);
      });
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading clip...</div>
      </div>
    );
  }

  if (error || !clip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Clip Not Found</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* STC Branding */}
        <div className="text-center mb-8">
          <h2 className="text-sm font-medium text-brand-purple tracking-wide uppercase">
            Acme Talent
          </h2>
          <p className="text-xs text-gray-400 mt-1">Interview Clip</p>
        </div>

        {/* Clip Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <h1 className="text-lg font-semibold text-gray-900 mb-1">{clip.title}</h1>
            <p className="text-sm text-gray-500">
              {clip.candidateName} &middot; {clip.jobTitle}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {clip.interviewType.replace(/_/g, ' ')} &middot; {formatTime(clip.duration)} clip
            </p>
          </div>

          {/* Audio Player */}
          {clip.audioUrl ? (
            <div className="px-6 pb-6">
              <audio controls className="w-full" preload="metadata">
                <source src={clip.audioUrl} />
                Your browser does not support audio playback.
              </audio>
            </div>
          ) : (
            <div className="px-6 pb-6">
              <div className="bg-gray-100 rounded-lg p-4 text-center text-sm text-gray-500">
                Audio not available
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Shared by {clip.sharedBy} &middot;{' '}
              {new Date(clip.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
