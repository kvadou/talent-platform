'use client';

import { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  MicrophoneIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

interface InterviewerRow {
  id: string;
  name: string;
  email: string;
  avgInterviewerPercent: number;
  totalInterviews: number;
  flaggedCount: number;
}

interface TalkTimeData {
  interviewers: InterviewerRow[];
  overall: {
    avgInterviewerPercent: number;
    totalInterviews: number;
    totalFlagged: number;
  };
}

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
  color?: 'purple' | 'green' | 'red' | 'amber' | 'cyan';
}) {
  const colorClasses = {
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-success-50 text-success-600',
    red: 'bg-danger-50 text-danger-600',
    amber: 'bg-warning-50 text-warning-600',
    cyan: 'bg-cyan-50 text-cyan-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{title}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function StatusBadge({ percent }: { percent: number }) {
  if (percent < 45) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700">
        Balanced
      </span>
    );
  }
  if (percent <= 55) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-700">
        Watch
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger-100 text-danger-700">
      Action Needed
    </span>
  );
}

function MiniProgressBar({ percent }: { percent: number }) {
  const barColor =
    percent < 45 ? 'bg-success-500' : percent <= 55 ? 'bg-warning-500' : 'bg-danger-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-900">{percent}%</span>
    </div>
  );
}

export default function TalkTimeAnalyticsPage() {
  const [data, setData] = useState<TalkTimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        const qs = params.toString();
        const res = await fetch(`/api/analytics/talk-time${qs ? `?${qs}` : ''}`);
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
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl" />
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
            <MicrophoneIcon className="h-7 w-7 text-cyan-600" />
            Talk-Time Analytics
          </h1>
          <p className="text-gray-500 mt-1">
            Monitor interviewer vs candidate speaking balance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Avg Interviewer Talk %"
          value={`${data.overall.avgInterviewerPercent}%`}
          subtitle="Target: 25-50%"
          icon={ChartBarIcon}
          color={data.overall.avgInterviewerPercent <= 50 ? 'cyan' : 'amber'}
        />
        <StatCard
          title="Interviews Analyzed"
          value={data.overall.totalInterviews}
          subtitle="With transcripts"
          icon={UserGroupIcon}
          color="purple"
        />
        <StatCard
          title="Flagged Interviews"
          value={data.overall.totalFlagged}
          subtitle="Interviewer talked >50%"
          icon={ExclamationTriangleIcon}
          color={data.overall.totalFlagged === 0 ? 'green' : 'red'}
        />
      </div>

      {/* Interviewer Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Interviewer Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3">Interviewer</th>
                <th className="px-6 py-3">Avg Talk %</th>
                <th className="px-6 py-3">Interviews</th>
                <th className="px-6 py-3">Flagged</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.interviewers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <ChartBarIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No interview transcripts found</p>
                    <p className="text-gray-300 text-xs mt-1">
                      Talk-time data appears once interviews are recorded and transcribed
                    </p>
                  </td>
                </tr>
              ) : (
                data.interviewers.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{row.name}</div>
                      <div className="text-xs text-gray-400">{row.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <MiniProgressBar percent={row.avgInterviewerPercent} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {row.totalInterviews}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {row.flaggedCount > 0 ? (
                        <span className="text-danger-600 font-medium">{row.flaggedCount}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge percent={row.avgInterviewerPercent} />
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
