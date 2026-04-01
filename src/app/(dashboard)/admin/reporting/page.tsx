'use client';

import { useEffect, useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';

type PipelineMetrics = {
  totalApplications: number;
  activeApplications: number;
  hiredCount: number;
  rejectedCount: number;
  avgTimeToHire: number;
  avgTimeInStage: Record<string, { stageName: string; avgDays: number }>;
  slaBreaches: number;
  topSources: Array<{ source: string; count: number }>;
};

export default function ReportingPage() {
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [marketId, setMarketId] = useState<string>('');
  const [jobId, setJobId] = useState<string>('');
  const [markets, setMarkets] = useState<Array<{ id: string; name: string }>>([]);
  const [jobs, setJobs] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    let url = `/api/reporting/metrics?range=${dateRange}`;
    if (marketId) url += `&marketId=${marketId}`;
    if (jobId) url += `&jobId=${jobId}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setMetrics(data.metrics);
        if (data.markets) setMarkets(data.markets);
        if (data.jobs) setJobs(data.jobs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [dateRange, marketId, jobId]);

  function exportCsv() {
    if (!metrics) return;

    const rows: string[][] = [
      ['Metric', 'Value'],
      ['Total Applications', String(metrics.totalApplications)],
      ['Active Applications', String(metrics.activeApplications)],
      ['Hired', String(metrics.hiredCount)],
      ['Rejected', String(metrics.rejectedCount)],
      ['Conversion Rate', `${metrics.totalApplications > 0 ? ((metrics.hiredCount / metrics.totalApplications) * 100).toFixed(1) : 0}%`],
      ['Avg Time to Hire (days)', String(metrics.avgTimeToHire > 0 ? metrics.avgTimeToHire.toFixed(1) : 'N/A')],
      ['SLA Breaches', String(metrics.slaBreaches)],
      [''],
      ['Stage', 'Avg Days'],
      ...Object.values(metrics.avgTimeInStage).map((s) => [s.stageName, s.avgDays.toFixed(1)]),
      [''],
      ['Source', 'Applications'],
      ...metrics.topSources.map((s) => [s.source, String(s.count)]),
    ];

    const csvContent = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporting-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (!metrics) return <div className="p-6">No data available</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Reporting & Analytics</h1>
          <p className="text-sm text-gray-600">Pipeline health, time-to-hire, and performance metrics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={marketId}
            onChange={(e) => {
              setMarketId(e.target.value);
              setJobId('');
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Markets</option>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            icon={<ArrowDownTrayIcon className="h-4 w-4" />}
            onClick={exportCsv}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-600 mb-1">Total Applications</div>
            <div className="text-3xl font-bold text-gray-900">{metrics.totalApplications}</div>
            <div className="text-xs text-gray-500 mt-2">{metrics.activeApplications} active</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-600 mb-1">Hired</div>
            <div className="text-3xl font-bold text-brand-purple">{metrics.hiredCount}</div>
            <div className="text-xs text-gray-500 mt-2">
              {metrics.totalApplications > 0
                ? ((metrics.hiredCount / metrics.totalApplications) * 100).toFixed(1)
                : 0}
              % conversion
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-600 mb-1">Avg Time to Hire</div>
            <div className="text-3xl font-bold text-gray-900">
              {metrics.avgTimeToHire > 0 ? metrics.avgTimeToHire.toFixed(0) : '\u2014'}
            </div>
            <div className="text-xs text-gray-500 mt-2">days</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-600 mb-1">SLA Breaches</div>
            <div className="text-3xl font-bold text-yellow-600">{metrics.slaBreaches}</div>
            <div className="text-xs text-gray-500 mt-2">unresolved</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Average Time in Stage" />
          <CardContent className="p-0">
            <div className="p-4 lg:p-0">
              <ResponsiveTable
                data={Object.entries(metrics.avgTimeInStage).map(([stageId, data]) => ({ stageId, ...data }))}
                columns={[
                  {
                    header: 'Stage',
                    accessor: (item) => <span className="text-sm text-gray-900">{item.stageName}</span>,
                  },
                  {
                    header: 'Avg Days',
                    className: 'text-right',
                    accessor: (item) => <span className="text-sm text-gray-700">{item.avgDays.toFixed(1)}</span>,
                  },
                ]}
                keyExtractor={(item) => item.stageId}
                emptyMessage="No stage data available"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Top Sources" />
          <CardContent className="p-0">
            <div className="p-4 lg:p-0">
              <ResponsiveTable
                data={metrics.topSources.map((source, idx) => ({ ...source, id: String(idx) }))}
                columns={[
                  {
                    header: 'Source',
                    accessor: (source) => <span className="text-sm text-gray-900">{source.source || 'Unknown'}</span>,
                  },
                  {
                    header: 'Applications',
                    className: 'text-right',
                    accessor: (source) => <span className="text-sm text-gray-700">{source.count}</span>,
                  },
                ]}
                keyExtractor={(source) => source.id}
                emptyMessage="No source data available"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
