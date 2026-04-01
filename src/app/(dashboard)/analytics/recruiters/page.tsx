'use client';

import { useEffect, useState } from 'react';
import { StatCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import {
  UserGroupIcon,
  CalendarIcon,
  ChartBarSquareIcon,
} from '@heroicons/react/24/outline';

interface RecruiterStat {
  id: string;
  name: string;
  email: string;
  role: string;
  interviews: number;
  feedback: number;
  stageMoves: number;
  emails: number;
  tasksCompleted: number;
  totalActions: number;
}

type DateRange = '7d' | '30d' | '90d' | 'all';

export default function RecruiterPerformancePage() {
  const [recruiters, setRecruiters] = useState<RecruiterStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/analytics/recruiters?range=${dateRange}`);
        if (!res.ok) throw new Error('Failed to fetch recruiter metrics');
        const json = await res.json();
        setRecruiters(json.recruiters);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [dateRange]);

  const totalInterviews = recruiters.reduce((sum, r) => sum + r.interviews, 0);
  const totalActions = recruiters.reduce((sum, r) => sum + r.totalActions, 0);
  const avgActions = recruiters.length > 0 ? Math.round(totalActions / recruiters.length) : 0;

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case 'HQ_ADMIN': return 'purple' as const;
      case 'MARKET_ADMIN': return 'cyan' as const;
      case 'RECRUITER': return 'info' as const;
      case 'HIRING_MANAGER': return 'yellow' as const;
      default: return 'neutral' as const;
    }
  };

  const formatRole = (role: string) =>
    role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  const columns = [
    {
      header: 'Recruiter',
      accessor: (row: RecruiterStat) => (
        <div>
          <div className="font-medium text-gray-900">{row.name}</div>
          <div className="text-xs text-gray-500">{row.email}</div>
        </div>
      ),
    },
    {
      header: 'Role',
      accessor: (row: RecruiterStat) => (
        <Badge variant={roleBadgeVariant(row.role)} size="sm">
          {formatRole(row.role)}
        </Badge>
      ),
    },
    {
      header: 'Interviews',
      accessor: (row: RecruiterStat) => <span>{row.interviews}</span>,
    },
    {
      header: 'Feedback',
      accessor: (row: RecruiterStat) => <span>{row.feedback}</span>,
    },
    {
      header: 'Stage Moves',
      accessor: (row: RecruiterStat) => <span>{row.stageMoves}</span>,
    },
    {
      header: 'Emails',
      accessor: (row: RecruiterStat) => <span>{row.emails}</span>,
    },
    {
      header: 'Tasks Done',
      accessor: (row: RecruiterStat) => <span>{row.tasksCompleted}</span>,
    },
    {
      header: 'Total Actions',
      accessor: (row: RecruiterStat) => (
        <span className="font-bold text-gray-900">{row.totalActions}</span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-xl"></div>
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <UserGroupIcon className="h-7 w-7 text-purple-600" />
            Recruiter Performance
          </h1>
          <p className="text-gray-500 mt-1">Activity metrics by team member.</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as DateRange)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Active Recruiters"
          value={recruiters.length}
          icon={<UserGroupIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Total Interviews"
          value={totalInterviews}
          icon={<CalendarIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Avg Actions / Recruiter"
          value={avgActions}
          icon={<ChartBarSquareIcon className="h-5 w-5" />}
        />
      </div>

      {/* Recruiter Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <ResponsiveTable
          data={recruiters}
          columns={columns}
          keyExtractor={(row) => row.id}
          emptyMessage="No recruiter activity found for this period."
        />
      </div>
    </div>
  );
}
