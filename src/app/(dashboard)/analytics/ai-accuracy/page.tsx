'use client';

import { useState, useEffect } from 'react';
import {
  SparklesIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  UserGroupIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
} from '@heroicons/react/24/outline';

interface AIAccuracyData {
  summary: {
    totalFeedback: number;
    helpfulCount: number;
    notHelpfulCount: number;
    helpfulRate: number;
    agreementRate: number;
    avgScoreDifference: number;
  };
  feedbackTypes: {
    AGREE: number;
    DISAGREE_TOO_HIGH: number;
    DISAGREE_TOO_LOW: number;
    PARTIALLY_AGREE: number;
    NO_RESPONSE: number;
  };
  outcomeCorrelation: {
    highScoreHired: number;
    highScoreNotHired: number;
    lowScoreHired: number;
    lowScoreNotHired: number;
  };
  commonIssues: {
    incorrectStrengths: [string, number][];
    incorrectConcerns: [string, number][];
    missedStrengths: [string, number][];
    missedConcerns: [string, number][];
  };
  recentFeedback: Array<{
    id: string;
    createdAt: string;
    jobTitle: string;
    aiRecommendation: string;
    aiScore: number;
    humanRecommendation: string | null;
    feedbackType: string | null;
    wasAIHelpful: boolean | null;
    wasHired: boolean | null;
  }>;
  dateRange: {
    start: string;
    end: string;
    days: number;
  };
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'purple',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof SparklesIcon;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'purple' | 'green' | 'red' | 'blue' | 'amber';
}) {
  const colorClasses = {
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-success-50 text-success-600',
    red: 'bg-danger-50 text-danger-600',
    blue: 'bg-cyan-50 text-cyan-600',
    amber: 'bg-warning-50 text-warning-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${trend === 'up' ? 'text-success-600' : trend === 'down' ? 'text-danger-600' : 'text-gray-500'}`}>
            {trend === 'up' ? <ArrowTrendingUpIcon className="h-4 w-4" /> : trend === 'down' ? <ArrowTrendingDownIcon className="h-4 w-4" /> : null}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{title}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function FeedbackTypeChart({ data }: { data: AIAccuracyData['feedbackTypes'] }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return <div className="text-gray-400 text-sm">No feedback data yet</div>;

  const items = [
    { key: 'AGREE', label: 'AI was spot on', color: 'bg-success-500', count: data.AGREE },
    { key: 'PARTIALLY_AGREE', label: 'Partially agree', color: 'bg-cyan-500', count: data.PARTIALLY_AGREE },
    { key: 'DISAGREE_TOO_HIGH', label: 'AI too optimistic', color: 'bg-warning-500', count: data.DISAGREE_TOO_HIGH },
    { key: 'DISAGREE_TOO_LOW', label: 'AI too harsh', color: 'bg-purple-500', count: data.DISAGREE_TOO_LOW },
    { key: 'NO_RESPONSE', label: 'No response', color: 'bg-gray-300', count: data.NO_RESPONSE },
  ].filter(item => item.count > 0);

  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.key}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">{item.label}</span>
            <span className="text-gray-900 font-medium">{item.count} ({((item.count / total) * 100).toFixed(0)}%)</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${item.color} rounded-full transition-all`}
              style={{ width: `${(item.count / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function OutcomeMatrix({ data }: { data: AIAccuracyData['outcomeCorrelation'] }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return <div className="text-gray-400 text-sm text-center py-8">No outcome data yet</div>;

  // Calculate precision and recall
  const truePositives = data.highScoreHired;
  const falsePositives = data.highScoreNotHired;
  const trueNegatives = data.lowScoreNotHired;
  const falseNegatives = data.lowScoreHired;

  const precision = truePositives + falsePositives > 0
    ? (truePositives / (truePositives + falsePositives)) * 100
    : 0;
  const recall = truePositives + falseNegatives > 0
    ? (truePositives / (truePositives + falseNegatives)) * 100
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="col-span-2 text-sm text-gray-500 pb-1">AI Prediction vs Actual Outcome</div>
        <div className="text-xs text-gray-400">High AI Score (70+)</div>
        <div className="text-xs text-gray-400">Low AI Score (&lt;70)</div>

        <div className="bg-success-100 rounded-lg p-3">
          <div className="text-lg font-bold text-success-700">{truePositives}</div>
          <div className="text-xs text-success-600">Hired</div>
        </div>
        <div className="bg-warning-100 rounded-lg p-3">
          <div className="text-lg font-bold text-warning-700">{falseNegatives}</div>
          <div className="text-xs text-warning-600">Hired (AI missed)</div>
        </div>

        <div className="bg-danger-100 rounded-lg p-3">
          <div className="text-lg font-bold text-danger-700">{falsePositives}</div>
          <div className="text-xs text-danger-600">Not Hired (AI wrong)</div>
        </div>
        <div className="bg-gray-100 rounded-lg p-3">
          <div className="text-lg font-bold text-gray-700">{trueNegatives}</div>
          <div className="text-xs text-gray-600">Not Hired</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900">{precision.toFixed(0)}%</div>
          <div className="text-xs text-gray-500">Precision</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900">{recall.toFixed(0)}%</div>
          <div className="text-xs text-gray-500">Recall</div>
        </div>
      </div>
    </div>
  );
}

function RecommendationBadge({ recommendation }: { recommendation: string | null }) {
  if (!recommendation) return <span className="text-gray-400">-</span>;

  const colors: Record<string, string> = {
    STRONG_YES: 'bg-success-100 text-success-700',
    YES: 'bg-success-50 text-success-600',
    NO: 'bg-danger-50 text-danger-600',
    STRONG_NO: 'bg-danger-100 text-danger-700',
  };

  const labels: Record<string, string> = {
    STRONG_YES: 'Strong Yes',
    YES: 'Yes',
    NO: 'No',
    STRONG_NO: 'Strong No',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[recommendation] || 'bg-gray-100 text-gray-600'}`}>
      {labels[recommendation] || recommendation}
    </span>
  );
}

export default function AIAccuracyDashboard() {
  const [data, setData] = useState<AIAccuracyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/analytics/ai-accuracy?days=${days}`);
        if (!res.ok) throw new Error('Failed to fetch data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [days]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <SparklesIcon className="h-7 w-7 text-purple-600" />
            AI Accuracy Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Track how well AI recommendations align with human decisions and hiring outcomes
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Total Feedback"
          value={data.summary.totalFeedback}
          subtitle="Scorecard submissions with AI"
          icon={ChartBarIcon}
          color="purple"
        />
        <StatCard
          title="Helpful Rate"
          value={`${data.summary.helpfulRate.toFixed(0)}%`}
          subtitle={`${data.summary.helpfulCount} found helpful`}
          icon={HandThumbUpIcon}
          color={data.summary.helpfulRate >= 70 ? 'green' : data.summary.helpfulRate >= 50 ? 'amber' : 'red'}
        />
        <StatCard
          title="Agreement Rate"
          value={`${data.summary.agreementRate.toFixed(0)}%`}
          subtitle="AI matched human decision"
          icon={CheckCircleIcon}
          color={data.summary.agreementRate >= 70 ? 'green' : data.summary.agreementRate >= 50 ? 'amber' : 'red'}
        />
        <StatCard
          title="Avg Score Diff"
          value={`${data.summary.avgScoreDifference >= 0 ? '+' : ''}${data.summary.avgScoreDifference.toFixed(1)}`}
          subtitle="AI vs Human (positive = AI higher)"
          icon={data.summary.avgScoreDifference >= 0 ? ArrowTrendingUpIcon : ArrowTrendingDownIcon}
          color={Math.abs(data.summary.avgScoreDifference) <= 10 ? 'green' : 'amber'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Feedback Type Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Feedback Distribution</h2>
          <FeedbackTypeChart data={data.feedbackTypes} />
        </div>

        {/* Outcome Correlation Matrix */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Outcome Correlation</h2>
          <OutcomeMatrix data={data.outcomeCorrelation} />
        </div>
      </div>

      {/* Common Issues */}
      {(data.commonIssues.incorrectStrengths.length > 0 ||
        data.commonIssues.incorrectConcerns.length > 0 ||
        data.commonIssues.missedStrengths.length > 0 ||
        data.commonIssues.missedConcerns.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-warning-500" />
            AI Blind Spots
          </h2>
          <div className="grid grid-cols-2 gap-6">
            {data.commonIssues.incorrectStrengths.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Strengths AI Overestimated</h3>
                <div className="flex flex-wrap gap-2">
                  {data.commonIssues.incorrectStrengths.map(([strength, count]) => (
                    <span key={strength} className="px-2 py-1 bg-danger-50 text-danger-700 rounded text-xs">
                      {strength} ({count})
                    </span>
                  ))}
                </div>
              </div>
            )}
            {data.commonIssues.missedStrengths.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Strengths AI Missed</h3>
                <div className="flex flex-wrap gap-2">
                  {data.commonIssues.missedStrengths.map(([strength, count]) => (
                    <span key={strength} className="px-2 py-1 bg-success-50 text-success-700 rounded text-xs">
                      {strength} ({count})
                    </span>
                  ))}
                </div>
              </div>
            )}
            {data.commonIssues.incorrectConcerns.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Concerns That Were Unfounded</h3>
                <div className="flex flex-wrap gap-2">
                  {data.commonIssues.incorrectConcerns.map(([concern, count]) => (
                    <span key={concern} className="px-2 py-1 bg-success-50 text-success-700 rounded text-xs">
                      {concern} ({count})
                    </span>
                  ))}
                </div>
              </div>
            )}
            {data.commonIssues.missedConcerns.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Concerns AI Missed</h3>
                <div className="flex flex-wrap gap-2">
                  {data.commonIssues.missedConcerns.map(([concern, count]) => (
                    <span key={concern} className="px-2 py-1 bg-warning-50 text-warning-700 rounded text-xs">
                      {concern} ({count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Feedback Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Recent Feedback</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Job</th>
                <th className="px-6 py-3">AI Rec</th>
                <th className="px-6 py-3">AI Score</th>
                <th className="px-6 py-3">Human Rec</th>
                <th className="px-6 py-3">Feedback</th>
                <th className="px-6 py-3">Helpful</th>
                <th className="px-6 py-3">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.recentFeedback.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                    No feedback submitted yet
                  </td>
                </tr>
              ) : (
                data.recentFeedback.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {row.jobTitle}
                    </td>
                    <td className="px-6 py-4">
                      <RecommendationBadge recommendation={row.aiRecommendation} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {row.aiScore}/100
                    </td>
                    <td className="px-6 py-4">
                      <RecommendationBadge recommendation={row.humanRecommendation} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {row.feedbackType?.replace(/_/g, ' ').toLowerCase() || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {row.wasAIHelpful === true ? (
                        <HandThumbUpIcon className="h-5 w-5 text-success-500" />
                      ) : row.wasAIHelpful === false ? (
                        <HandThumbDownIcon className="h-5 w-5 text-danger-500" />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {row.wasHired === true ? (
                        <span className="text-success-600 font-medium">Hired</span>
                      ) : row.wasHired === false ? (
                        <span className="text-gray-500">Not Hired</span>
                      ) : (
                        <span className="text-gray-400">Pending</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
