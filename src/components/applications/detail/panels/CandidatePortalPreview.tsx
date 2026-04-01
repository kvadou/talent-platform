'use client';

import { useState, useEffect } from 'react';
import {
  EyeIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  ClockIcon,
  ChartBarIcon,
  FireIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

type Props = {
  candidateId: string;
  applicationId: string;
  portalToken?: string;
};

interface EngagementData {
  totalViews: number;
  lastViewedAt: string | null;
  uniqueViewDays: number;
  totalTimeSpent: number;
  puzzlesAttempted: number;
  puzzlesSolved: number;
  puzzleBestStreak: number;
}

function formatTimeSpent(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CandidatePortalPreview({ candidateId, applicationId, portalToken }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [engagementLoading, setEngagementLoading] = useState(true);

  // Fetch engagement data
  useEffect(() => {
    async function fetchEngagement() {
      try {
        const res = await fetch(`/api/applications/${applicationId}/engagement`);
        if (res.ok) {
          const data = await res.json();
          setEngagement(data.engagement);
        }
      } catch {
        // Silent fail
      } finally {
        setEngagementLoading(false);
      }
    }
    fetchEngagement();
  }, [applicationId]);

  // The portal URL uses the candidate's portal token for preview
  const portalUrl = portalToken
    ? `/status/${portalToken}?preview=true`
    : null;

  function handleIframeLoad() {
    setLoading(false);
  }

  function handleIframeError() {
    setLoading(false);
    setError(true);
  }

  function refreshPreview() {
    setLoading(true);
    setError(false);
    // Force iframe refresh by updating key
    const iframe = document.getElementById('portal-preview-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  }

  // Engagement Stats Component
  const EngagementStats = () => {
    if (engagementLoading) {
      return (
        <div className="p-4 border-b border-gray-100 bg-white">
          <div className="animate-pulse flex gap-4">
            <div className="h-16 w-16 bg-gray-100 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 rounded w-24" />
              <div className="h-3 bg-gray-100 rounded w-32" />
            </div>
          </div>
        </div>
      );
    }

    if (!engagement || engagement.totalViews === 0) {
      return (
        <div className="p-4 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <EyeIcon className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">No portal activity yet</p>
              <p className="text-xs text-gray-400">Candidate hasn&apos;t viewed their portal</p>
            </div>
          </div>
        </div>
      );
    }

    const puzzleAccuracy = engagement.puzzlesAttempted > 0
      ? Math.round((engagement.puzzlesSolved / engagement.puzzlesAttempted) * 100)
      : 0;

    return (
      <div className="p-4 border-b border-gray-100 bg-gradient-to-br from-[#7C3AED]/5 to-[#3BA9DA]/5">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <ChartBarIcon className="w-3.5 h-3.5" />
          Portal Engagement
        </h4>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Page Views */}
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <EyeIcon className="w-4 h-4 text-[#3BA9DA]" />
              <span className="text-xs font-medium text-gray-500">Views</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{engagement.totalViews}</p>
            <p className="text-xs text-gray-400">
              {engagement.uniqueViewDays} unique day{engagement.uniqueViewDays !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Time Spent */}
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <ClockIcon className="w-4 h-4 text-[#7C3AED]" />
              <span className="text-xs font-medium text-gray-500">Time</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatTimeSpent(engagement.totalTimeSpent)}</p>
            <p className="text-xs text-gray-400">total on portal</p>
          </div>
        </div>

        {/* Chess Puzzle Stats */}
        {(engagement.puzzlesAttempted > 0 || engagement.puzzlesSolved > 0) && (
          <div className="mt-3 bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">♟</span>
              <span className="text-xs font-medium text-gray-500">Chess Puzzles</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-lg font-bold text-success-600">{engagement.puzzlesSolved}</span>
                <span className="text-gray-400 mx-1">/</span>
                <span className="text-sm text-gray-600">{engagement.puzzlesAttempted}</span>
                <span className="text-xs text-gray-400 ml-1">solved</span>
              </div>
              <div className="flex items-center gap-2">
                {puzzleAccuracy >= 70 && (
                  <span className="px-2 py-0.5 bg-success-100 text-success-700 text-xs font-medium rounded-full">
                    {puzzleAccuracy}% accuracy
                  </span>
                )}
                {engagement.puzzleBestStreak > 1 && (
                  <span className="px-2 py-0.5 bg-[#F5D547]/20 text-[#B8860B] text-xs font-medium rounded-full flex items-center gap-1">
                    <FireIcon className="w-3 h-3" />
                    {engagement.puzzleBestStreak} streak
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Last Activity */}
        {engagement.lastViewedAt && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Last viewed {formatRelativeTime(engagement.lastViewedAt)}</span>
          </div>
        )}
      </div>
    );
  };

  if (!portalUrl) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Candidate Portal Preview</h3>
        </div>

        {/* Engagement Stats */}
        <EngagementStats />

        {/* No Portal Access */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <EyeIcon className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 font-medium">Portal Preview Not Available</p>
            <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
              The portal link was emailed to the candidate. Engagement stats are shown above.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Preview Banner */}
      <div className="bg-warning-500 text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <EyeIcon className="w-4 h-4" />
          <span className="text-sm font-medium">Viewing as candidate</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshPreview}
            className="p-1 hover:bg-warning-600 rounded transition-colors"
            title="Refresh preview"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
          <a
            href={portalUrl.replace('?preview=true', '')}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-warning-600 rounded transition-colors"
            title="Open in new tab"
          >
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-white">
        <h3 className="font-semibold text-gray-900">Candidate Portal Preview</h3>
        <p className="text-xs text-gray-500 mt-1">
          This is what the candidate sees when they view their application status
        </p>
      </div>

      {/* Engagement Stats */}
      <EngagementStats />

      {/* iframe Container */}
      <div className="flex-1 relative bg-gray-100 min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading portal...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-danger-100 flex items-center justify-center mx-auto mb-3">
                <EyeIcon className="w-6 h-6 text-danger-500" />
              </div>
              <p className="text-sm text-gray-600 font-medium">Failed to load portal</p>
              <button
                onClick={refreshPreview}
                className="text-sm text-brand-purple hover:underline mt-2"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        <iframe
          id="portal-preview-iframe"
          src={portalUrl}
          className="w-full h-full border-0"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title="Candidate Portal Preview"
          sandbox="allow-same-origin allow-scripts"
        />
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          Actions taken in preview mode will not affect the actual candidate portal
        </p>
      </div>
    </div>
  );
}
