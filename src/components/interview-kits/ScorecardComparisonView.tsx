'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  StarIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

interface Attribute {
  id: string;
  name: string;
  description: string | null;
  categoryName: string;
  categoryId: string;
}

interface Rating {
  id: string;
  attributeId: string;
  rating: number;
  notes: string | null;
  aiSuggested: number | null;
  attribute: {
    id: string;
    name: string;
    category: {
      id: string;
      name: string;
    };
  };
}

interface Scorecard {
  id: string;
  keyTakeaways: string | null;
  privateNotes: string | null;
  overallRecommendation: string;
  submittedAt: string | null;
  scorer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  ratings: Rating[];
}

interface Stats {
  totalScorecards: number;
  recommendations: Record<string, number>;
  attributeAverages: Record<string, { average: number; count: number; scores: number[] }>;
  overallAverage: number | null;
  consensus: string | null;
}

interface Interview {
  id: string;
  type: string;
  scheduledAt: string;
  candidate: { name: string };
  job: { title: string };
}

interface ScorecardComparisonData {
  interview: Interview;
  scorecards: Scorecard[];
  attributes: Attribute[];
  stats: Stats;
}

interface ScorecardComparisonViewProps {
  interviewId: string;
}

const RECOMMENDATION_COLORS: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  STRONG_YES: { bg: 'bg-success-100', text: 'text-success-800', icon: CheckCircleIcon },
  YES: { bg: 'bg-success-50', text: 'text-success-700', icon: CheckCircleIcon },
  NO: { bg: 'bg-danger-50', text: 'text-danger-700', icon: XCircleIcon },
  STRONG_NO: { bg: 'bg-danger-100', text: 'text-danger-800', icon: XCircleIcon },
};

const RATING_COLORS: Record<number, string> = {
  1: 'bg-danger-500',
  2: 'bg-warning-500',
  3: 'bg-yellow-500',
  4: 'bg-success-500',
  5: 'bg-success-500',
};

export function ScorecardComparisonView({ interviewId }: ScorecardComparisonViewProps) {
  const [data, setData] = useState<ScorecardComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/scorecards`);
      if (!res.ok) throw new Error('Failed to load scorecards');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center">
        <ExclamationTriangleIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-danger-600">{error || 'Failed to load comparison data'}</p>
      </div>
    );
  }

  if (data.scorecards.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-12 text-center">
        <ChartBarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No Scorecards Yet</h3>
        <p className="text-gray-500">
          Scorecards will appear here once interviewers submit their feedback.
        </p>
      </div>
    );
  }

  // Group attributes by category
  const categorizedAttributes = data.attributes.reduce((acc, attr) => {
    if (!acc[attr.categoryId]) {
      acc[attr.categoryId] = {
        name: attr.categoryName,
        attributes: [],
      };
    }
    acc[attr.categoryId].attributes.push(attr);
    return acc;
  }, {} as Record<string, { name: string; attributes: Attribute[] }>);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Scorecards */}
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-500">Scorecards</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {data.stats.totalScorecards}
          </div>
        </div>

        {/* Overall Average */}
        <div className="bg-white rounded-xl border p-4">
          <div className="text-sm text-gray-500">Avg Rating</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {data.stats.overallAverage?.toFixed(1) || '—'}/5
          </div>
        </div>

        {/* Consensus */}
        <div className="bg-white rounded-xl border p-4 md:col-span-2">
          <div className="text-sm text-gray-500">Team Consensus</div>
          {data.stats.consensus ? (
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mt-1 ${
                RECOMMENDATION_COLORS[data.stats.consensus]?.bg || 'bg-gray-100'
              } ${RECOMMENDATION_COLORS[data.stats.consensus]?.text || 'text-gray-700'}`}
            >
              {data.stats.consensus.replace('_', ' ')}
            </div>
          ) : (
            <div className="text-lg font-medium text-warning-600 mt-1">
              Mixed opinions
            </div>
          )}
        </div>
      </div>

      {/* Recommendation Breakdown */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Recommendation Breakdown</h3>
        <div className="flex items-center gap-4 flex-wrap">
          {Object.entries(data.stats.recommendations).map(([rec, count]) => {
            const colors = RECOMMENDATION_COLORS[rec] || { bg: 'bg-gray-100', text: 'text-gray-700' };
            const Icon = colors.icon || CheckCircleIcon;
            return (
              <div
                key={rec}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${colors.bg} ${colors.text}`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{rec.replace('_', ' ')}</span>
                <span className="ml-2 px-2 py-0.5 bg-white/50 rounded-full text-sm">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scorers Summary */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Interviewers</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.scorecards.map((sc) => {
            const colors = RECOMMENDATION_COLORS[sc.overallRecommendation] || {
              bg: 'bg-gray-100',
              text: 'text-gray-700',
            };
            const avgRating =
              sc.ratings.length > 0
                ? sc.ratings.reduce((sum, r) => sum + r.rating, 0) / sc.ratings.length
                : null;

            return (
              <div key={sc.id} className="border rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <UserIcon className="h-5 w-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {sc.scorer.firstName} {sc.scorer.lastName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {sc.submittedAt
                        ? format(new Date(sc.submittedAt), 'MMM d, h:mm a')
                        : 'Not submitted'}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${colors.bg} ${colors.text}`}
                  >
                    {sc.overallRecommendation.replace('_', ' ')}
                  </span>
                  {avgRating && (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <StarSolidIcon className="h-4 w-4 text-yellow-400" />
                      {avgRating.toFixed(1)}
                    </div>
                  )}
                </div>
                {sc.keyTakeaways && (
                  <p className="mt-3 text-sm text-gray-600 line-clamp-2">{sc.keyTakeaways}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Attribute Comparison */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Attribute Comparison</h3>
          <p className="text-sm text-gray-500 mt-1">
            Click a category to see detailed ratings per attribute
          </p>
        </div>

        {Object.entries(categorizedAttributes).map(([categoryId, category]) => (
          <div key={categoryId} className="border-b last:border-b-0">
            {/* Category Header */}
            <button
              onClick={() =>
                setExpandedCategory(expandedCategory === categoryId ? null : categoryId)
              }
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900">{category.name}</span>
              <div className="flex items-center gap-4">
                {/* Category average */}
                {(() => {
                  const categoryAttrIds = category.attributes.map((a) => a.id);
                  const categoryScores = categoryAttrIds
                    .map((id) => data.stats.attributeAverages[id]?.average)
                    .filter((v): v is number => v !== undefined);
                  const categoryAvg =
                    categoryScores.length > 0
                      ? categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length
                      : null;
                  return categoryAvg ? (
                    <span className="text-sm text-gray-500">
                      Avg: <span className="font-medium">{categoryAvg.toFixed(1)}</span>/5
                    </span>
                  ) : null;
                })()}
                <svg
                  className={`h-5 w-5 text-gray-400 transition-transform ${
                    expandedCategory === categoryId ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>

            {/* Expanded attributes */}
            {expandedCategory === categoryId && (
              <div className="bg-gray-50 px-6 py-4 space-y-4">
                {category.attributes.map((attr) => {
                  const attrStats = data.stats.attributeAverages[attr.id];
                  return (
                    <div key={attr.id} className="bg-white rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-medium text-gray-900">{attr.name}</div>
                          {attr.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{attr.description}</p>
                          )}
                        </div>
                        {attrStats && (
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">
                              {attrStats.average.toFixed(1)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {attrStats.count} ratings
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Scorer ratings */}
                      <div className="flex flex-wrap gap-2">
                        {data.scorecards.map((sc) => {
                          const rating = sc.ratings.find((r) => r.attributeId === attr.id);
                          if (!rating) return null;
                          return (
                            <div
                              key={sc.id}
                              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
                              title={rating.notes || undefined}
                            >
                              <span className="text-gray-600">
                                {sc.scorer.firstName[0]}
                                {sc.scorer.lastName[0]}
                              </span>
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span
                                    key={star}
                                    className={`w-3 h-3 rounded-full ${
                                      star <= rating.rating
                                        ? RATING_COLORS[rating.rating]
                                        : 'bg-gray-200'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="font-medium">{rating.rating}</span>
                              {rating.aiSuggested && rating.aiSuggested !== rating.rating && (
                                <span
                                  className="text-xs text-purple-600"
                                  title={`AI suggested ${rating.aiSuggested}`}
                                >
                                  (AI: {rating.aiSuggested})
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Variance indicator */}
                      {attrStats && attrStats.scores.length > 1 && (
                        <div className="mt-2 text-xs text-gray-500">
                          Range: {Math.min(...attrStats.scores)} - {Math.max(...attrStats.scores)}
                          {Math.max(...attrStats.scores) - Math.min(...attrStats.scores) >= 2 && (
                            <span className="ml-2 text-warning-600 font-medium">
                              ⚠ High variance
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Key Takeaways Comparison */}
      {data.scorecards.some((sc) => sc.keyTakeaways) && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Key Takeaways</h3>
          <div className="space-y-4">
            {data.scorecards
              .filter((sc) => sc.keyTakeaways)
              .map((sc) => (
                <div key={sc.id} className="border-l-4 border-brand-500 pl-4">
                  <div className="text-sm font-medium text-gray-900 mb-1">
                    {sc.scorer.firstName} {sc.scorer.lastName}
                  </div>
                  <p className="text-sm text-gray-600">{sc.keyTakeaways}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
