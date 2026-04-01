'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { BulkMoveStageModal } from '@/components/applications/BulkMoveStageModal';
import { BulkRejectModal } from '@/components/applications/BulkRejectModal';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import {
  ArrowsRightLeftIcon,
  XCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

type Application = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    resumeUrl: string | null;
  };
  job: {
    id: string;
    title: string;
    market: { name: string };
  };
  stage: {
    id: string;
    name: string;
    order: number;
  };
};

function statusVariant(status: string): 'success' | 'warning' | 'info' | 'error' | 'neutral' {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'HIRED':
      return 'info';
    case 'REJECTED':
      return 'error';
    case 'WITHDRAWN':
      return 'warning';
    default:
      return 'neutral';
  }
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [unauthorized, setUnauthorized] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'HIRED' | 'REJECTED' | 'WITHDRAWN'>('ALL');
  const [jobFilter, setJobFilter] = useState<string>('ALL');
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);

  // Bulk selection
  const selection = useBulkSelection(applications);

  // Modal states
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, jobFilter]);

  // Fetch jobs for filter dropdown
  useEffect(() => {
    async function fetchJobs() {
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs((data.jobs ?? []).map((j: any) => ({ id: j.id, title: j.title })));
      }
    }
    fetchJobs();
  }, []);

  const fetchApplications = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (jobFilter !== 'ALL') params.set('jobId', jobFilter);
    if (debouncedQuery.trim()) params.set('search', debouncedQuery.trim());
    params.set('page', currentPage.toString());

    const res = await fetch(`/api/applications?${params.toString()}`);
    if (!res.ok) {
      if (res.status === 401) setUnauthorized(true);
      return;
    }
    const payload = await res.json();
    setApplications(
      (payload.applications ?? []).map((a: any) => ({
        ...a,
        createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date(a.createdAt).toISOString(),
        updatedAt: typeof a.updatedAt === 'string' ? a.updatedAt : new Date(a.updatedAt).toISOString(),
      }))
    );
    setPagination(payload.pagination ?? null);
  }, [statusFilter, jobFilter, debouncedQuery, currentPage]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    if (!pagination) return [];
    const pages: (number | string)[] = [];
    const { page, totalPages } = pagination;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  function handleBulkSuccess() {
    selection.deselectAll();
    fetchApplications();
  }

  if (unauthorized) return <div className="p-6">Unauthorized</div>;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="opacity-0 animate-reveal-1">
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-navy-900 tracking-tight">
          Applications
        </h1>
        <p className="mt-2 text-lg text-slate-600 font-medium">
          Track and manage candidates across all jobs and stages
        </p>
      </div>

      {/* Filters Card */}
      <div className="opacity-0 animate-reveal-2">
        <Card variant="elevated">
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex-1">
                <Input
                  placeholder="Search by name, email, job, stage..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="w-full md:w-48"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="HIRED">Hired</option>
                <option value="REJECTED">Rejected</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </Select>
              <Select
                value={jobFilter}
                onChange={(e) => setJobFilter(e.target.value)}
                className="w-full md:w-48"
              >
                <option value="ALL">All Jobs</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Summary & Pagination */}
      {pagination && (
        <div className="opacity-0 animate-reveal-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              Showing{' '}
              <span className="font-semibold text-navy-900">
                {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}
              </span>
              –
              <span className="font-semibold text-navy-900">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-semibold text-navy-900">{pagination.total}</span> applications
            </p>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                <div className="flex items-center gap-1">
                  {getPageNumbers().map((pageNum, idx) =>
                    pageNum === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">
                        ...
                      </span>
                    ) : (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum as number)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          pagination.page === pageNum
                            ? 'bg-purple-600 text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  )}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Applications Table */}
      <div className="opacity-0 animate-reveal-4">
        <Card variant="elevated">
          <CardContent noPadding>
            <div className="p-4 lg:p-0">
              <ResponsiveTable
                data={applications}
                columns={[
                  {
                    header: 'Candidate',
                    accessor: (app) => (
                      <div>
                        <Link
                          href={`/applications/${app.id}`}
                          className="text-sm font-display font-bold text-navy-900 hover:text-purple-700 transition-colors block"
                        >
                          {app.candidate.firstName} {app.candidate.lastName}
                        </Link>
                        <div className="text-xs text-slate-600 mt-0.5">{app.candidate.email}</div>
                      </div>
                    ),
                  },
                  {
                    header: 'Job',
                    accessor: (app) => (
                      <div>
                        <div className="text-sm font-semibold text-navy-900">{app.job.title}</div>
                        <div className="text-xs text-slate-600">{app.job.market.name}</div>
                      </div>
                    ),
                  },
                  {
                    header: 'Stage',
                    accessor: (app) => (
                      <span className="text-sm font-medium text-slate-700">{app.stage.name}</span>
                    ),
                  },
                  {
                    header: 'Status',
                    accessor: (app) => <Badge variant={statusVariant(app.status)}>{app.status}</Badge>,
                  },
                  {
                    header: 'Updated',
                    mobileLabel: 'Last Updated',
                    accessor: (app) => (
                      <span className="text-sm text-slate-600">
                        {new Intl.DateTimeFormat('en', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }).format(new Date(app.updatedAt))}
                      </span>
                    ),
                  },
                  {
                    header: 'Actions',
                    className: 'text-right',
                    accessor: (app) => (
                      <Link
                        href={`/applications/${app.id}`}
                        className="text-purple-600 hover:text-purple-700 font-semibold text-sm transition-colors"
                      >
                        View
                      </Link>
                    ),
                  },
                ]}
                keyExtractor={(app) => app.id}
                emptyMessage="No applications found."
                onRowClick={(app) => (window.location.href = `/applications/${app.id}`)}
                selection={{
                  isSelected: selection.isSelected,
                  toggle: selection.toggle,
                  toggleAll: selection.toggleAll,
                  isAllSelected: selection.isAllSelected,
                  isPartiallySelected: selection.isPartiallySelected,
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={pagination.page <= 1}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={pagination.page >= pagination.totalPages}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selection.selectedCount}
        onClear={selection.deselectAll}
        itemLabel="application"
        actions={[
          {
            label: 'Move Stage',
            icon: <ArrowsRightLeftIcon className="h-4 w-4" />,
            onClick: () => setShowMoveModal(true),
            variant: 'primary',
          },
          {
            label: 'Reject',
            icon: <XCircleIcon className="h-4 w-4" />,
            onClick: () => setShowRejectModal(true),
            variant: 'danger',
          },
        ]}
      />

      {/* Modals */}
      {showMoveModal && (
        <BulkMoveStageModal
          applicationIds={Array.from(selection.selectedIds)}
          onClose={() => setShowMoveModal(false)}
          onSuccess={handleBulkSuccess}
        />
      )}

      {showRejectModal && (
        <BulkRejectModal
          applicationIds={Array.from(selection.selectedIds)}
          onClose={() => setShowRejectModal(false)}
          onSuccess={handleBulkSuccess}
        />
      )}
    </div>
  );
}
