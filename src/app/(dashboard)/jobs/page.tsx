'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  BriefcaseIcon,
  MapPinIcon,
  CalendarIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChevronUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

type Job = {
  id: string;
  title: string;
  status: string;
  market: { id: string; name: string };
  location: string | null;
  createdAt: string;
  updatedAt: string;
  candidateCount: number;
  newCount: number;
  daysOpen: number;
};

type Market = {
  id: string;
  name: string;
};

type SortField = 'title' | 'market' | 'location' | 'candidateCount' | 'newCount' | 'daysOpen' | 'status';
type SortDir = 'asc' | 'desc';

export default function JobsPage() {
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters - initialize from URL params
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState<string>(() => searchParams.get('status') || 'ALL');
  const [marketId, setMarketId] = useState<string>(() => searchParams.get('marketId') || 'ALL');
  const [showFilters, setShowFilters] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);

  // View mode (list or card) - auto card on mobile
  const [viewMode, setViewMode] = useState<'list' | 'card'>(() => {
    if (typeof window !== 'undefined') {
      // Force card view on mobile
      if (window.innerWidth < 768) return 'card';
      return (localStorage.getItem('jobs-view-mode') as 'list' | 'card') || 'list';
    }
    return 'list';
  });

  // Auto-switch to card view on mobile resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewMode('card');
      }
    };
    window.addEventListener('resize', handleResize);
    // Check on mount
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Bulk selection
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());

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
  }, [status, marketId]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== 'ALL') params.set('status', status);
    if (marketId !== 'ALL') params.set('marketId', marketId);
    if (debouncedQuery.trim()) params.set('search', debouncedQuery.trim());
    params.set('page', currentPage.toString());

    const res = await fetch(`/api/jobs?${params.toString()}`);
    if (!res.ok) {
      if (res.status === 401) setUnauthorized(true);
      setLoading(false);
      return;
    }
    const payload = await res.json();
    setJobs(payload.jobs ?? []);
    setMarkets(payload.markets ?? []);
    setPagination(payload.pagination ?? null);
    setLoading(false);
  }, [status, marketId, debouncedQuery, currentPage]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jobs-view-mode', viewMode);
    }
  }, [viewMode]);

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

  const sorted = useMemo(() => {
    return [...jobs].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'market':
          aVal = a.market.name.toLowerCase();
          bVal = b.market.name.toLowerCase();
          break;
        case 'location':
          aVal = (a.location ?? '').toLowerCase();
          bVal = (b.location ?? '').toLowerCase();
          break;
        case 'candidateCount':
          aVal = a.candidateCount;
          bVal = b.candidateCount;
          break;
        case 'newCount':
          aVal = a.newCount;
          bVal = b.newCount;
          break;
        case 'daysOpen':
          aVal = a.daysOpen;
          bVal = b.daysOpen;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [jobs, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const clearFilters = () => {
    setQuery('');
    setStatus('ALL');
    setMarketId('ALL');
  };

  const hasActiveFilters = query || status !== 'ALL' || marketId !== 'ALL';

  const toggleSelectAll = () => {
    if (selectedJobs.size === sorted.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(sorted.map((j) => j.id)));
    }
  };

  const toggleSelectJob = (jobId: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-left hover:text-gray-900 transition-colors"
    >
      {children}
      <ChevronUpDownIcon
        className={`w-4 h-4 ${sortField === field ? 'text-brand-purple' : 'text-gray-400'}`}
      />
    </button>
  );

  if (unauthorized) return <div className="p-6">Unauthorized</div>;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">All Jobs</h1>
        <Link href="/jobs/new">
          <Button icon={<PlusIcon className="h-5 w-5" />}>Add</Button>
        </Link>
      </div>

      {/* Filter Panel */}
      <div className="bg-white border border-gray-200 rounded-lg">
        {/* Filter Header */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <FunnelIcon className="w-4 h-4" />
            Filter
            {hasActiveFilters && (
              <span className="px-2 py-0.5 text-xs bg-brand-purple text-white rounded-full">
                Active
              </span>
            )}
          </div>
          {showFilters ? (
            <ChevronUpIcon className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {/* Filter Content */}
        {showFilters && (
          <div className="px-4 pb-4 border-t border-gray-100">
            {/* Search */}
            <div className="relative mt-4 mb-4">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
              />
            </div>

            {/* Filter Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Job Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple bg-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PUBLISHED">Open</option>
                  <option value="DRAFT">Draft</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Market</label>
                <select
                  value={marketId}
                  onChange={(e) => setMarketId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple bg-white"
                >
                  <option value="ALL">All Markets</option>
                  {markets.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-sm text-brand-purple hover:underline"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {pagination && (
            <p className="text-sm text-gray-600">
              Showing{' '}
              <span className="font-semibold text-gray-900">
                {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}
              </span>
              –
              <span className="font-semibold text-gray-900">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-semibold text-gray-900">{pagination.total}</span> Jobs
            </p>
          )}
          {selectedJobs.size > 0 && (
            <Button variant="outline" size="sm">
              Bulk actions ({selectedJobs.size})
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <div className="hidden sm:flex items-center gap-1">
                {getPageNumbers().map((pageNum, idx) =>
                  pageNum === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">
                      ...
                    </span>
                  ) : (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum as number)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        pagination.page === pageNum
                          ? 'bg-brand-purple text-white'
                          : 'text-gray-700 hover:bg-gray-100'
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
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Hide view toggle on mobile - card view is forced */}
          <div className="hidden md:flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${
                viewMode === 'list'
                  ? 'bg-brand-purple text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
              title="List view"
            >
              <ListBulletIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 ${
                viewMode === 'card'
                  ? 'bg-brand-purple text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
              title="Card view"
            >
              <Squares2X2Icon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Jobs List/Grid */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading jobs...</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <BriefcaseIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs found</h3>
          <p className="text-gray-600 mb-6">
            {hasActiveFilters ? 'Try adjusting your filters' : 'Get started by creating your first job'}
          </p>
          {!hasActiveFilters && (
            <Link href="/jobs/new">
              <Button icon={<PlusIcon className="h-5 w-5" />}>Create Your First Job</Button>
            </Link>
          )}
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedJobs.size === sorted.length && sorted.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <SortHeader field="title">Job</SortHeader>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <SortHeader field="status">Status</SortHeader>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <SortHeader field="market">Market</SortHeader>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <SortHeader field="location">Location</SortHeader>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <SortHeader field="candidateCount">Candidates</SortHeader>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <SortHeader field="newCount">New</SortHeader>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <SortHeader field="daysOpen">Days Open</SortHeader>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedJobs.has(job.id)}
                        onChange={() => toggleSelectJob(job.id)}
                        className="w-4 h-4 rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-brand-purple"
                      >
                        {job.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={
                          job.status === 'PUBLISHED'
                            ? 'published'
                            : job.status === 'DRAFT'
                            ? 'draft'
                            : 'archived'
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{job.market.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{job.location || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-center font-medium">
                      {job.candidateCount}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {job.newCount > 0 ? (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-success-100 text-success-800 rounded-full">
                          {job.newCount}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">{job.daysOpen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sorted.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="group block">
              <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-brand-purple/30">
                <CardContent className="h-full flex flex-col">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <StatusBadge
                      status={
                        job.status === 'PUBLISHED'
                          ? 'published'
                          : job.status === 'DRAFT'
                          ? 'draft'
                          : 'archived'
                      }
                    />
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {job.daysOpen} days
                    </div>
                  </div>

                  {/* Job Title */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 group-hover:text-brand-purple transition-colors line-clamp-2">
                    {job.title}
                  </h3>

                  {/* Job Details */}
                  <div className="space-y-2 mb-4 flex-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <BriefcaseIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{job.market.name}</span>
                    </div>
                    {job.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPinIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{job.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600">
                        <span className="font-semibold text-gray-900">{job.candidateCount}</span> candidates
                      </span>
                      {job.newCount > 0 && (
                        <span className="text-success-600 font-medium">+{job.newCount} new</span>
                      )}
                    </div>
                    <ArrowRightIcon className="h-4 w-4 text-gray-400 group-hover:text-brand-purple group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Bottom Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4">
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
    </div>
  );
}
