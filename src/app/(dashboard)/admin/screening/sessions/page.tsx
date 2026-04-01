'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

interface Session {
  id: string;
  type: string;
  status: string;
  aiScore: number | null;
  aiRecommendation: string | null;
  knockoutTriggered: boolean;
  humanDecision: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  application: {
    candidate: {
      firstName: string;
      lastName: string;
      email: string;
    };
    job: { id: string; title: string };
  };
  questionSet: { id: string; name: string } | null;
  _count: { messages: number };
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-gray-100', text: 'text-gray-700' },
  IN_PROGRESS: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  AWAITING_RESPONSE: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  COMPLETED: { bg: 'bg-success-100', text: 'text-success-700' },
  EXPIRED: { bg: 'bg-gray-100', text: 'text-gray-500' },
  HUMAN_TAKEOVER: { bg: 'bg-purple-100', text: 'text-purple-700' },
};

const RECOMMENDATION_COLORS: Record<string, { bg: string; text: string }> = {
  ADVANCE: { bg: 'bg-success-100', text: 'text-success-700' },
  SCHEDULE_CALL: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  REJECT: { bg: 'bg-danger-100', text: 'text-danger-700' },
  HOLD: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

export default function ScreeningSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'needs_review' | 'completed'>('all');

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/screening/sessions?limit=50';
      if (filter === 'needs_review') {
        url += '&needsReview=true';
      } else if (filter === 'completed') {
        url += '&status=COMPLETED';
      }
      const res = await fetch(url);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const needsReviewCount = sessions.filter(
    (s) => s.status === 'COMPLETED' && !s.humanDecision && s.aiScore !== null && s.aiScore >= 50 && s.aiScore < 70
  ).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="h-7 w-7 text-purple-600" />
            Screening Sessions
          </h1>
          <p className="text-gray-600 mt-1">Review AI screening conversations and make decisions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        <FunnelIcon className="h-5 w-5 text-gray-400" />
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All Sessions
        </button>
        <button
          onClick={() => setFilter('needs_review')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
            filter === 'needs_review' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Needs Review
          {needsReviewCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-yellow-500 text-white rounded-full">{needsReviewCount}</span>
          )}
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filter === 'completed' ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Completed
        </button>
      </div>

      {/* Sessions List */}
      {loading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
          <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No screening sessions</h3>
          <p className="text-gray-600">Sessions will appear here when candidates complete AI screening</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: Session }) {
  const statusColor = STATUS_COLORS[session.status] || STATUS_COLORS.PENDING;
  const recommendationColor = session.aiRecommendation
    ? RECOMMENDATION_COLORS[session.aiRecommendation] || RECOMMENDATION_COLORS.HOLD
    : null;

  const needsReview =
    session.status === 'COMPLETED' &&
    !session.humanDecision &&
    session.aiScore !== null &&
    session.aiScore >= 50 &&
    session.aiScore < 70;

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${needsReview ? 'border-yellow-300' : 'border-gray-200'} p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-gray-900">
              {session.application.candidate.firstName} {session.application.candidate.lastName}
            </h3>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor.bg} ${statusColor.text}`}>
              {session.status.replace('_', ' ')}
            </span>
            {session.knockoutTriggered && (
              <span className="px-2 py-0.5 text-xs font-medium bg-danger-100 text-danger-700 rounded-full flex items-center gap-1">
                <ExclamationTriangleIcon className="h-3 w-3" />
                Knockout
              </span>
            )}
            {needsReview && (
              <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
                <ClockIcon className="h-3 w-3" />
                Needs Review
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{session.application.job.title}</span>
            <span>&bull;</span>
            <span>{session._count.messages} messages</span>
            <span>&bull;</span>
            <span>Updated {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}</span>
          </div>

          {/* Scores and Recommendation */}
          <div className="flex items-center gap-4 mt-3">
            {session.aiScore !== null && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">AI Score:</span>
                <span
                  className={`font-semibold ${
                    session.aiScore >= 70 ? 'text-success-600' : session.aiScore >= 50 ? 'text-yellow-600' : 'text-danger-600'
                  }`}
                >
                  {session.aiScore}/100
                </span>
              </div>
            )}

            {recommendationColor && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${recommendationColor.bg} ${recommendationColor.text}`}>
                AI: {session.aiRecommendation?.replace('_', ' ')}
              </span>
            )}

            {session.humanDecision && (
              <span className="flex items-center gap-1 text-sm text-gray-700">
                <CheckCircleIcon className="h-4 w-4 text-success-500" />
                Human: {session.humanDecision.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>

        <Link
          href={`/admin/screening/sessions/${session.id}`}
          className="flex items-center gap-1 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
        >
          <EyeIcon className="h-4 w-4" />
          View
        </Link>
      </div>
    </div>
  );
}
