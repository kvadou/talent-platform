'use client';

import { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  FunnelIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';

interface Insight {
  id: string;
  type: 'success' | 'warning' | 'info' | 'action';
  category: 'source' | 'pipeline' | 'quality' | 'speed';
  title: string;
  description: string;
  metric?: string;
  actionable?: string;
}

interface AnalyticsData {
  summary: {
    totalApplications: number;
    totalHires: number;
    activeApplications: number;
    avgTimeToHire: number;
    conversionRate: number;
  };
  timeToHire: {
    average: number;
    trend: Array<{ week: string; avgDays: number; count: number }>;
    bySource: Array<{ source: string; avgDays: number; count: number }>;
  };
  sourceEffectiveness: Array<{
    source: string;
    applications: number;
    hires: number;
    hireRate: number;
    avgAiScore: number | null;
  }>;
  pipelineVelocity: Array<{
    stageId: string;
    stageName: string;
    order: number;
    avgDays: number;
    candidates: number;
  }>;
  weeklyTrend: Array<{ week: string; applications: number; hires: number }>;
  dateRange: { start: string; end: string; days: number };
}

const COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16'];

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'purple',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof ChartBarIcon;
  color?: 'purple' | 'green' | 'blue' | 'amber';
}) {
  const colorClasses = {
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-success-50 text-success-600',
    blue: 'bg-cyan-50 text-cyan-600',
    amber: 'bg-warning-50 text-warning-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm text-gray-500">{title}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

function formatWeekLabel(weekStr: string): string {
  const date = new Date(weekStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatSourceName(source: string): string {
  return source
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function InsightCard({ insight }: { insight: Insight }) {
  const icons = {
    success: CheckCircleIcon,
    warning: ExclamationTriangleIcon,
    info: InformationCircleIcon,
    action: LightBulbIcon,
  };
  const colors = {
    success: 'border-success-200 bg-success-50',
    warning: 'border-warning-200 bg-warning-50',
    info: 'border-cyan-200 bg-cyan-50',
    action: 'border-purple-200 bg-purple-50',
  };
  const iconColors = {
    success: 'text-success-600',
    warning: 'text-warning-600',
    info: 'text-cyan-600',
    action: 'text-purple-600',
  };

  const Icon = icons[insight.type];

  return (
    <div className={`border rounded-lg p-4 ${colors[insight.type]}`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${iconColors[insight.type]}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-900">{insight.title}</h3>
            {insight.metric && (
              <span className="text-xs px-2 py-0.5 bg-white rounded-full text-gray-600 border border-gray-200">
                {insight.metric}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">{insight.description}</p>
          {insight.actionable && (
            <p className="text-sm text-gray-700 mt-2 font-medium">
              <LightBulbIcon className="h-4 w-4 inline mr-1 text-warning-500" />
              {insight.actionable}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [analyticsRes, insightsRes] = await Promise.all([
          fetch(`/api/analytics/hiring?days=${days}`),
          fetch(`/api/analytics/insights?days=${days}`),
        ]);
        if (!analyticsRes.ok) throw new Error('Failed to fetch analytics');
        const analyticsJson = await analyticsRes.json();
        setData(analyticsJson);

        if (insightsRes.ok) {
          const insightsJson = await insightsRes.json();
          setInsights(insightsJson.insights || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
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
          <div className="grid grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="h-80 bg-gray-200 rounded-xl"></div>
            <div className="h-80 bg-gray-200 rounded-xl"></div>
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
            <ChartBarIcon className="h-7 w-7 text-purple-600" />
            Hiring Analytics
          </h1>
          <p className="text-gray-500 mt-1">
            Track hiring performance, source ROI, and pipeline efficiency
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
          <option value={180}>Last 6 months</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard
          title="Total Applications"
          value={data.summary.totalApplications}
          icon={UserGroupIcon}
          color="purple"
        />
        <StatCard
          title="Total Hires"
          value={data.summary.totalHires}
          icon={CheckCircleIcon}
          color="green"
        />
        <StatCard
          title="Active Pipeline"
          value={data.summary.activeApplications}
          icon={FunnelIcon}
          color="blue"
        />
        <StatCard
          title="Avg Time to Hire"
          value={`${data.summary.avgTimeToHire} days`}
          icon={ClockIcon}
          color="amber"
        />
        <StatCard
          title="Conversion Rate"
          value={`${data.summary.conversionRate}%`}
          subtitle="Applications to Hire"
          icon={ArrowTrendingUpIcon}
          color="green"
        />
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-purple-600" />
            AI Recommendations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-6">
        {/* Weekly Applications & Hires Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Trend</h2>
          {data.weeklyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="week"
                  tickFormatter={formatWeekLabel}
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  labelFormatter={(label) => `Week of ${formatWeekLabel(label as string)}`}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="applications"
                  name="Applications"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="hires"
                  name="Hires"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No data for this period
            </div>
          )}
        </div>

        {/* Time to Hire Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Time to Hire Trend</h2>
          {data.timeToHire.trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.timeToHire.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="week"
                  tickFormatter={formatWeekLabel}
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  label={{ value: 'Days', angle: -90, position: 'insideLeft', fontSize: 12 }}
                />
                <Tooltip
                  labelFormatter={(label) => `Week of ${formatWeekLabel(label as string)}`}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(value?: number, name?: string) => [
                    `${value ?? 0} days`,
                    name === 'avgDays' ? 'Avg Time to Hire' : (name ?? ''),
                  ]}
                />
                <Bar dataKey="avgDays" name="Avg Days" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No hires in this period
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-2 gap-6">
        {/* Source Effectiveness */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Source Effectiveness</h2>
          {data.sourceEffectiveness.length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={data.sourceEffectiveness.slice(0, 6)}
                  layout="vertical"
                  margin={{ left: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis
                    dataKey="source"
                    type="category"
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    tickFormatter={formatSourceName}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(value?: number) => [value ?? 0, 'Applications']}
                  />
                  <Bar dataKey="applications" radius={[0, 4, 4, 0]}>
                    {data.sourceEffectiveness.slice(0, 6).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Source stats table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-2 font-medium">Source</th>
                      <th className="pb-2 font-medium text-right">Apps</th>
                      <th className="pb-2 font-medium text-right">Hires</th>
                      <th className="pb-2 font-medium text-right">Rate</th>
                      <th className="pb-2 font-medium text-right">Avg AI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.sourceEffectiveness.map((source) => (
                      <tr key={source.source}>
                        <td className="py-2 font-medium text-gray-900">
                          {formatSourceName(source.source)}
                        </td>
                        <td className="py-2 text-right text-gray-600">{source.applications}</td>
                        <td className="py-2 text-right text-gray-600">{source.hires}</td>
                        <td className="py-2 text-right">
                          <span
                            className={`font-medium ${
                              source.hireRate >= 10
                                ? 'text-success-600'
                                : source.hireRate >= 5
                                ? 'text-warning-600'
                                : 'text-gray-600'
                            }`}
                          >
                            {source.hireRate}%
                          </span>
                        </td>
                        <td className="py-2 text-right text-gray-600">
                          {source.avgAiScore !== null ? source.avgAiScore : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No source data available
            </div>
          )}
        </div>

        {/* Pipeline Velocity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Velocity</h2>
          <p className="text-sm text-gray-500 mb-4">Average days candidates spend in each stage</p>
          {data.pipelineVelocity.length > 0 ? (
            <div className="space-y-3">
              {data.pipelineVelocity.map((stage, index) => {
                const maxDays = Math.max(...data.pipelineVelocity.map((s) => s.avgDays), 1);
                const barWidth = (stage.avgDays / maxDays) * 100;
                const isBottleneck = stage.avgDays > 5; // Flag stages > 5 days

                return (
                  <div key={stage.stageId}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        {stage.stageName}
                        {isBottleneck && (
                          <span className="text-xs px-1.5 py-0.5 bg-warning-100 text-warning-700 rounded">
                            Bottleneck
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-gray-500">
                        {stage.avgDays} days ({stage.candidates} candidates)
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isBottleneck ? 'bg-warning-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${Math.max(barWidth, 5)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400">
              No pipeline data available
            </div>
          )}
        </div>
      </div>

      {/* Time to Hire by Source */}
      {data.timeToHire.bySource.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Time to Hire by Source</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="pb-3 font-medium">Source</th>
                  <th className="pb-3 font-medium text-right">Avg Days to Hire</th>
                  <th className="pb-3 font-medium text-right">Hires</th>
                  <th className="pb-3 font-medium w-1/2">Distribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.timeToHire.bySource
                  .sort((a, b) => a.avgDays - b.avgDays)
                  .map((source, index) => {
                    const maxDays = Math.max(...data.timeToHire.bySource.map((s) => s.avgDays), 1);
                    return (
                      <tr key={source.source}>
                        <td className="py-3 font-medium text-gray-900">
                          {formatSourceName(source.source)}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`font-bold ${
                              source.avgDays <= 14
                                ? 'text-success-600'
                                : source.avgDays <= 30
                                ? 'text-warning-600'
                                : 'text-danger-600'
                            }`}
                          >
                            {source.avgDays} days
                          </span>
                        </td>
                        <td className="py-3 text-right text-gray-600">{source.count}</td>
                        <td className="py-3">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                source.avgDays <= 14
                                  ? 'bg-success-500'
                                  : source.avgDays <= 30
                                  ? 'bg-warning-500'
                                  : 'bg-danger-500'
                              }`}
                              style={{ width: `${(source.avgDays / maxDays) * 100}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
