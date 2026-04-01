'use client';

import { useEffect, useState } from 'react';
import { PlusIcon, SparklesIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDistanceToNow } from 'date-fns';
import { twMerge } from 'tailwind-merge';

type Interview = {
  id: string;
  scheduledAt: string;
  duration: number;
  type: string;
  interviewer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  feedback: Array<{
    id: string;
    recommendation: string | null;
    strengths: string | null;
    weaknesses: string | null;
    notes: string | null;
    submittedAt: string | null;
  }>;
};

type ScorecardComparison = {
  interview: {
    id: string;
    type: string;
    scheduledAt: string;
    candidate: { name: string };
    job: { title: string };
  };
  scorecards: Array<{
    id: string;
    scorer: { id: string; firstName: string; lastName: string; email: string };
    overallRecommendation: string;
    keyTakeaways: string | null;
    ratings: Array<{
      attributeId: string;
      rating: number;
      notes: string | null;
      aiSuggested: number | null;
      attribute: { id: string; name: string; category: { id: string; name: string } };
    }>;
    submittedAt: string | null;
  }>;
  attributes: Array<{
    id: string;
    name: string;
    description: string | null;
    categoryName: string;
    categoryId: string;
  }>;
  stats: {
    totalScorecards: number;
    recommendations: Record<string, number>;
    attributeAverages: Record<string, { average: number; count: number; scores: number[] }>;
    overallAverage: number | null;
    consensus: string | null;
  };
};

type Props = {
  interviews: Interview[];
  onRefresh: () => void;
};

// --- Helpers ---

const REC_LABELS: Record<string, string> = {
  STRONG_YES: 'Strong Yes',
  YES: 'Yes',
  NO: 'No',
  STRONG_NO: 'Strong No',
};

const REC_COLORS: Record<string, string> = {
  STRONG_YES: 'bg-success-500',
  YES: 'bg-success-400',
  NO: 'bg-danger-400',
  STRONG_NO: 'bg-danger-500',
};

const REC_BADGE: Record<string, 'success' | 'error' | 'neutral'> = {
  STRONG_YES: 'success',
  YES: 'success',
  NO: 'error',
  STRONG_NO: 'error',
};

function RatingDots({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={twMerge(
            dotSize,
            'rounded-full',
            n <= rating ? 'bg-brand-purple' : 'bg-gray-200'
          )}
        />
      ))}
    </div>
  );
}

function AttributeSummaryContent({ interviews }: { interviews: Interview[] }) {
  const [comparisons, setComparisons] = useState<ScorecardComparison[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch comparison data for all interviews that have feedback
  useEffect(() => {
    const interviewsWithFeedback = interviews.filter((iv) => iv.feedback.length > 0);
    if (interviewsWithFeedback.length === 0) {
      setLoading(false);
      return;
    }

    Promise.all(
      interviewsWithFeedback.map((iv) =>
        fetch(`/api/interviews/${iv.id}/scorecards`)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      )
    ).then((results) => {
      setComparisons(results.filter(Boolean));
      setLoading(false);
    });
  }, [interviews]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Filter to comparisons that actually have kit scorecards (not just legacy feedback)
  const withScorecards = comparisons.filter((c) => c.stats.totalScorecards > 0);

  if (withScorecards.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
          <ChartBarIcon className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-900 font-medium">No scorecard data to compare</p>
        <p className="text-sm text-gray-500 mt-1">
          Submit scorecards with attribute ratings to see the comparison view.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {withScorecards.map((comparison) => (
        <InterviewComparison key={comparison.interview.id} data={comparison} />
      ))}
    </div>
  );
}

function InterviewComparison({ data }: { data: ScorecardComparison }) {
  const { scorecards, attributes, stats } = data;
  const recOrder = ['STRONG_YES', 'YES', 'NO', 'STRONG_NO'];
  const totalRecs = Object.values(stats.recommendations).reduce((a, b) => a + b, 0);

  // Group attributes by category
  const categories = attributes.reduce<Record<string, typeof attributes>>((acc, attr) => {
    if (!acc[attr.categoryName]) acc[attr.categoryName] = [];
    acc[attr.categoryName].push(attr);
    return acc;
  }, {});

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        {/* Interview header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {data.interview.type.replace(/_/g, ' ')}
            </p>
            <p className="text-xs text-gray-500">
              {stats.totalScorecards} scorecard{stats.totalScorecards !== 1 ? 's' : ''}
              {stats.consensus && (
                <> &middot; Consensus: <span className="font-medium">{REC_LABELS[stats.consensus] || stats.consensus}</span></>
              )}
            </p>
          </div>
          {stats.overallAverage !== null && (
            <div className="text-right">
              <p className="text-2xl font-semibold text-gray-900">
                {stats.overallAverage.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500">avg rating</p>
            </div>
          )}
        </div>

        {/* Recommendation distribution bar */}
        {totalRecs > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Recommendations
            </p>
            <div className="flex rounded-full overflow-hidden h-3">
              {recOrder.map((rec) => {
                const count = stats.recommendations[rec] || 0;
                if (count === 0) return null;
                const pct = (count / totalRecs) * 100;
                return (
                  <div
                    key={rec}
                    className={twMerge(REC_COLORS[rec])}
                    style={{ width: `${pct}%` }}
                    title={`${REC_LABELS[rec]}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="flex gap-4 mt-1.5">
              {recOrder.map((rec) => {
                const count = stats.recommendations[rec] || 0;
                if (count === 0) return null;
                return (
                  <span key={rec} className="text-xs text-gray-600">
                    <span className={twMerge('inline-block w-2 h-2 rounded-full mr-1', REC_COLORS[rec])} />
                    {REC_LABELS[rec]} ({count})
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Attribute comparison table */}
        {Object.entries(categories).map(([categoryName, attrs]) => (
          <div key={categoryName}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              {categoryName}
            </p>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                      Attribute
                    </th>
                    {scorecards.map((sc) => (
                      <th
                        key={sc.id}
                        className="text-center px-2 py-2 text-xs font-medium text-gray-500 whitespace-nowrap"
                      >
                        {sc.scorer.firstName} {sc.scorer.lastName.charAt(0)}.
                      </th>
                    ))}
                    <th className="text-center px-2 py-2 text-xs font-medium text-gray-500">
                      Avg
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attrs.map((attr, i) => {
                    const avg = stats.attributeAverages[attr.id];
                    const scores = avg?.scores || [];
                    const spread = scores.length > 1
                      ? Math.max(...scores) - Math.min(...scores)
                      : 0;

                    return (
                      <tr
                        key={attr.id}
                        className={twMerge(
                          i < attrs.length - 1 && 'border-b border-gray-100',
                          spread >= 3 && 'bg-warning-50/50'
                        )}
                      >
                        <td className="px-3 py-2 text-gray-700">
                          <span className="font-medium">{attr.name}</span>
                          {spread >= 3 && (
                            <span className="ml-1.5 text-[10px] text-warning-600 font-medium">
                              SPLIT
                            </span>
                          )}
                        </td>
                        {scorecards.map((sc) => {
                          const rating = sc.ratings.find(
                            (r) => r.attributeId === attr.id
                          );
                          return (
                            <td key={sc.id} className="text-center px-2 py-2">
                              {rating ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-gray-900 font-medium">
                                    {rating.rating}
                                  </span>
                                  <RatingDots rating={rating.rating} />
                                </div>
                              ) : (
                                <span className="text-gray-300">&mdash;</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="text-center px-2 py-2">
                          {avg ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-brand-purple font-semibold">
                                {avg.average.toFixed(1)}
                              </span>
                              <RatingDots rating={Math.round(avg.average)} size="md" />
                            </div>
                          ) : (
                            <span className="text-gray-300">&mdash;</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Per-scorer recommendation row */}
        <div className="flex flex-wrap gap-2">
          {scorecards.map((sc) => (
            <div
              key={sc.id}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
            >
              <span className="text-sm text-gray-700">
                {sc.scorer.firstName} {sc.scorer.lastName.charAt(0)}.
              </span>
              <Badge variant={REC_BADGE[sc.overallRecommendation] || 'neutral'}>
                {REC_LABELS[sc.overallRecommendation] || sc.overallRecommendation}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ScorecardsView({ interviews, onRefresh }: Props) {
  const [activeTab, setActiveTab] = useState<'individual' | 'summary'>('individual');

  // Get all feedback from interviews
  const allFeedback = interviews.flatMap((interview) =>
    interview.feedback.map((fb) => ({
      ...fb,
      interviewType: interview.type,
      interviewer: interview.interviewer,
      scheduledAt: interview.scheduledAt,
    }))
  );

  const getRecommendationColor = (recommendation: string | null) => {
    switch (recommendation) {
      case 'STRONG_HIRE':
        return 'success';
      case 'HIRE':
        return 'success';
      case 'NO_HIRE':
        return 'error';
      case 'STRONG_NO_HIRE':
        return 'error';
      default:
        return 'neutral';
    }
  };

  const formatRecommendation = (recommendation: string | null) => {
    if (!recommendation) return 'No recommendation';
    return recommendation.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-gray-900">Scorecards</h2>
          <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* AI Summary Banner */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100">
        <div className="flex items-start gap-3">
          <SparklesIcon className="w-5 h-5 text-purple-600 mt-0.5" />
          <div>
            <p className="font-medium text-gray-900">Summarize scorecards in seconds</p>
            <p className="text-sm text-gray-600">
              Turn on AI-generated scorecard summaries to turn written feedback into one clear, objective summary.
            </p>
          </div>
        </div>
        <button className="px-4 py-2 text-sm font-medium text-brand-purple border border-brand-purple rounded-lg hover:bg-brand-purple/5 transition-colors">
          Open settings
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('individual')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'individual'
                ? 'border-brand-purple text-brand-purple'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Individual scorecards
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'summary'
                ? 'border-brand-purple text-brand-purple'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Attribute summary
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'individual' ? (
        <div className="space-y-4">
          {allFeedback.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-900 font-medium">There are no submitted scorecards.</p>
              <p className="text-sm text-gray-500 mt-1">Consider submitting your own</p>
            </div>
          ) : (
            allFeedback.map((feedback) => (
              <Card key={feedback.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {feedback.interviewer.firstName} {feedback.interviewer.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {feedback.interviewType.replace(/_/g, ' ')}
                        {feedback.submittedAt && (
                          <> &middot; {formatDistanceToNow(new Date(feedback.submittedAt), { addSuffix: true })}</>
                        )}
                      </p>
                    </div>
                    <Badge variant={getRecommendationColor(feedback.recommendation) as 'success' | 'error' | 'neutral'}>
                      {formatRecommendation(feedback.recommendation)}
                    </Badge>
                  </div>

                  {feedback.strengths && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Strengths</p>
                      <p className="text-sm text-gray-700">{feedback.strengths}</p>
                    </div>
                  )}

                  {feedback.weaknesses && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Areas for Improvement</p>
                      <p className="text-sm text-gray-700">{feedback.weaknesses}</p>
                    </div>
                  )}

                  {feedback.notes && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                      <p className="text-sm text-gray-700">{feedback.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <AttributeSummaryContent interviews={interviews} />
      )}
    </div>
  );
}
