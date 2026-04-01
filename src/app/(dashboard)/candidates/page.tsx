'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { BulkTagModal } from '@/components/candidates/BulkTagModal';
import { BulkEmailModal } from '@/components/email/BulkEmailModal';
import { AdvancedSearchInput } from '@/components/search';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import {
  TagIcon,
  ArrowDownTrayIcon,
  EnvelopeIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  resumeUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  tags: string[];
  source: string | null;
  createdAt: string;
  updatedAt: string;
  greenhouseCandidateId: string | null;
  rank?: number;
  _count: {
    applications: number;
  };
  applications: Array<{
    id: string;
    status: string;
    createdAt: string;
    job: {
      id: string;
      title: string;
      market: { name: string };
    };
    stage: {
      id: string;
      name: string;
    };
  }>;
};

type Job = {
  id: string;
  title: string;
};

type Stage = {
  id: string;
  name: string;
  jobId: string;
};

const sourceLabels: Record<string, string> = {
  CAREER_PAGE: 'Career Page',
  LINKEDIN: 'LinkedIn',
  INDEED: 'Indeed',
  GOOGLE: 'Google',
  REFERRAL: 'Referral',
  AGENCY: 'Agency',
  OTHER: 'Other',
};

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loading, setLoading] = useState(false);

  // Search & filter state
  const [query, setQuery] = useState('');
  const [fullTextSearch, setFullTextSearch] = useState(true);
  const [sortBy, setSortBy] = useState<'updatedAt' | 'relevance' | 'createdAt'>('updatedAt');
  const [showFilters, setShowFilters] = useState(false);

  // Filter values
  const [hasApplicationsFilter, setHasApplicationsFilter] = useState<'ALL' | 'true' | 'false'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [appliedAfter, setAppliedAfter] = useState<string>('');
  const [appliedBefore, setAppliedBefore] = useState<string>('');
  const [jobFilter, setJobFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  // Reference data
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);

  // Bulk selection
  const selection = useBulkSelection(candidates);

  // Modal states
  const [showTagModal, setShowTagModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Auto-switch to relevance sorting when full-text search is used
  useEffect(() => {
    if (fullTextSearch && debouncedQuery.trim()) {
      setSortBy('relevance');
    }
  }, [fullTextSearch, debouncedQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [hasApplicationsFilter, sourceFilter, statusFilter, tagFilter, appliedAfter, appliedBefore, jobFilter, stageFilter]);

  // Fetch reference data
  useEffect(() => {
    async function fetchReferenceData() {
      try {
        const [jobsRes, tagsRes] = await Promise.all([
          fetch('/api/jobs'),
          fetch('/api/candidates/tags'),
        ]);

        if (jobsRes.ok) {
          const data = await jobsRes.json();
          setJobs(data.jobs || []);
        }

        if (tagsRes.ok) {
          const data = await tagsRes.json();
          setAllTags(data.tags || []);
        }
      } catch (err) {
        console.error('Error fetching reference data:', err);
      }
    }
    fetchReferenceData();
  }, []);

  // Fetch stages when job changes
  useEffect(() => {
    async function fetchStages() {
      if (jobFilter === 'ALL') {
        setStages([]);
        setStageFilter('ALL');
        return;
      }

      try {
        const res = await fetch(`/api/jobs/${jobFilter}/stages`);
        if (res.ok) {
          const data = await res.json();
          setStages(data.stages || []);
        }
      } catch (err) {
        console.error('Error fetching stages:', err);
      }
    }
    fetchStages();
  }, [jobFilter]);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();

    params.set('page', String(currentPage));
    params.set('limit', '50');

    if (debouncedQuery.trim()) {
      params.set('search', debouncedQuery.trim());
      params.set('fullTextSearch', String(fullTextSearch));
      if (fullTextSearch) {
        params.set('sortBy', sortBy);
      }
    }

    if (hasApplicationsFilter !== 'ALL') params.set('hasApplications', hasApplicationsFilter);
    if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (tagFilter) params.set('tags', tagFilter);
    if (appliedAfter) params.set('appliedAfter', appliedAfter);
    if (appliedBefore) params.set('appliedBefore', appliedBefore);
    if (jobFilter !== 'ALL') params.set('jobId', jobFilter);
    if (stageFilter !== 'ALL') params.set('stageId', stageFilter);

    try {
      const res = await fetch(`/api/candidates?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401) setUnauthorized(true);
        return;
      }
      const payload = await res.json();
      setCandidates(
        (payload.candidates ?? []).map((c: any) => ({
          ...c,
          createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date(c.createdAt).toISOString(),
          updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : new Date(c.updatedAt).toISOString(),
        }))
      );
      setPagination(payload.pagination || null);
    } catch (err) {
      console.error('Error fetching candidates:', err);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    debouncedQuery,
    fullTextSearch,
    sortBy,
    hasApplicationsFilter,
    sourceFilter,
    statusFilter,
    tagFilter,
    appliedAfter,
    appliedBefore,
    jobFilter,
    stageFilter,
  ]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (hasApplicationsFilter !== 'ALL') count++;
    if (sourceFilter !== 'ALL') count++;
    if (statusFilter !== 'ALL') count++;
    if (tagFilter) count++;
    if (appliedAfter) count++;
    if (appliedBefore) count++;
    if (jobFilter !== 'ALL') count++;
    if (stageFilter !== 'ALL') count++;
    return count;
  }, [hasApplicationsFilter, sourceFilter, statusFilter, tagFilter, appliedAfter, appliedBefore, jobFilter, stageFilter]);

  const clearFilters = () => {
    setHasApplicationsFilter('ALL');
    setSourceFilter('ALL');
    setStatusFilter('ALL');
    setTagFilter('');
    setAppliedAfter('');
    setAppliedBefore('');
    setJobFilter('ALL');
    setStageFilter('ALL');
  };

  function handleBulkSuccess() {
    selection.deselectAll();
    fetchCandidates();
  }

  async function handleBulkEmail(data: { subject: string; body: string; recipientIds: string[]; fromAddress?: string; cc?: string[]; attachments?: Array<{ name: string; type: string; size: number; content: string }> }) {
    const res = await fetch('/api/emails/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: data.subject,
        body: data.body,
        candidateIds: data.recipientIds,
        fromAddress: data.fromAddress,
        cc: data.cc,
        attachments: data.attachments,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to send emails');
    }

    const result = await res.json();
    if (result.summary.failed > 0) {
      throw new Error(`Sent ${result.summary.sent}, failed ${result.summary.failed}`);
    }

    handleBulkSuccess();
  }

  // Get selected candidates for email modal
  const selectedCandidatesForEmail = useMemo(() => {
    return candidates
      .filter((c) => selection.isSelected(c.id))
      .map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        jobTitle: c.applications[0]?.job?.title,
      }));
  }, [candidates, selection]);

  async function handleExport() {
    try {
      const res = await fetch('/api/candidates/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export',
          candidateIds: Array.from(selection.selectedIds),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([data.csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        selection.deselectAll();
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  }

  if (unauthorized) return <div className="p-6">Unauthorized</div>;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Candidates</h1>
          <p className="text-sm text-gray-600">
            Search and manage all candidates in your talent pool.
          </p>
        </div>
        <Link
          href="/candidates/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-purple text-white rounded-lg text-sm font-medium hover:bg-brand-purple/90 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Candidate
        </Link>
      </div>

      {/* Search & Filters Card */}
      <Card className="overflow-visible">
        <CardContent className="space-y-4 overflow-visible">
          {/* Main Search Bar */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <AdvancedSearchInput
              value={query}
              onChange={setQuery}
              placeholder={fullTextSearch ? "Search name, email, resume content, notes..." : "Search by name, email, phone..."}
              loading={loading}
              searchContext={{
                tags: allTags,
                stages: stages.map(s => s.name),
                jobs: jobs.map(j => j.title),
                statuses: ['ACTIVE', 'HIRED', 'REJECTED', 'WITHDRAWN'],
                sources: Object.keys(sourceLabels),
              }}
              className="flex-1"
            />

            {/* Full-Text Search Toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={fullTextSearch}
                onChange={(e) => setFullTextSearch(e.target.checked)}
                className="w-4 h-4 text-brand-purple border-gray-300 rounded focus:ring-brand-purple"
              />
              Full Text Search
            </label>

            {/* Sort By */}
            {fullTextSearch && debouncedQuery && (
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="w-full md:w-40"
              >
                <option value="relevance">Relevance</option>
                <option value="updatedAt">Last Activity</option>
                <option value="createdAt">Date Added</option>
              </Select>
            )}

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                activeFilterCount > 0
                  ? 'bg-brand-purple text-white border-brand-purple'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                  {activeFilterCount}
                </span>
              )}
              {showFilters ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="pt-4 border-t border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900">Advanced Filters</h4>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-brand-purple hover:underline flex items-center gap-1"
                  >
                    <XMarkIcon className="w-4 h-4" />
                    Clear all
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Application Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Application Status
                  </label>
                  <Select
                    value={hasApplicationsFilter}
                    onChange={(e) => setHasApplicationsFilter(e.target.value as typeof hasApplicationsFilter)}
                  >
                    <option value="ALL">All candidates</option>
                    <option value="true">With applications</option>
                    <option value="false">No applications</option>
                  </Select>
                </div>

                {/* Source */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
                  <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                    <option value="ALL">All sources</option>
                    {Object.entries(sourceLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Pipeline Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pipeline Status</label>
                  <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="ALL">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="HIRED">Hired</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="WITHDRAWN">Withdrawn</option>
                  </Select>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tags</label>
                  <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                    <option value="">All tags</option>
                    {allTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Job */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Job</label>
                  <Select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
                    <option value="ALL">All jobs</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Stage */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
                  <Select
                    value={stageFilter}
                    onChange={(e) => setStageFilter(e.target.value)}
                    disabled={jobFilter === 'ALL'}
                  >
                    <option value="ALL">All stages</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Applied After */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Applied After</label>
                  <Input
                    type="date"
                    value={appliedAfter}
                    onChange={(e) => setAppliedAfter(e.target.value)}
                  />
                </div>

                {/* Applied Before */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Applied Before</label>
                  <Input
                    type="date"
                    value={appliedBefore}
                    onChange={(e) => setAppliedBefore(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Count & Pagination Controls */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {pagination ? (
            pagination.total === 0 ? (
              'No candidates found'
            ) : (
              <>
                Showing {((pagination.page - 1) * pagination.limit) + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} candidate{pagination.total !== 1 ? 's' : ''}
              </>
            )
          ) : (
            `${candidates.length} candidate${candidates.length !== 1 ? 's' : ''} found`
          )}
        </span>

        {/* Pagination Controls */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            <div className="hidden sm:flex items-center gap-1">
              {(() => {
                const pages: (number | string)[] = [];
                const { page, totalPages } = pagination;
                pages.push(1);
                if (page > 3) pages.push('...');
                for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
                  if (!pages.includes(i)) pages.push(i);
                }
                if (page < totalPages - 2) pages.push('...');
                if (totalPages > 1 && !pages.includes(totalPages)) pages.push(totalPages);

                return pages.map((p, i) =>
                  typeof p === 'number' ? (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 text-sm font-medium rounded ${
                        p === page
                          ? 'bg-brand-purple text-white'
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  ) : (
                    <span key={i} className="px-1 text-gray-400">
                      {p}
                    </span>
                  )
                );
              })()}
            </div>

            <span className="sm:hidden text-xs text-gray-500">
              {pagination.page} / {pagination.totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {debouncedQuery && fullTextSearch && candidates.length > 0 && candidates[0].rank !== undefined && (
          <span className="text-xs text-gray-500">
            Sorted by {sortBy === 'relevance' ? 'relevance score' : sortBy === 'createdAt' ? 'date added' : 'last activity'}
          </span>
        )}
      </div>

      {/* Candidates Table */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 lg:p-0">
            <ResponsiveTable
              data={candidates}
              columns={[
                {
                  header: 'Candidate',
                  accessor: (candidate) => (
                    <div>
                      <Link
                        href={`/candidates/${candidate.id}`}
                        className="text-sm font-semibold text-brand-purple hover:underline block"
                      >
                        {candidate.firstName} {candidate.lastName}
                      </Link>
                      <div className="text-xs text-gray-500 mt-0.5">{candidate.email}</div>
                      {candidate.phone && <div className="text-xs text-gray-500">{candidate.phone}</div>}
                      {candidate.rank !== undefined && debouncedQuery && fullTextSearch && (
                        <div className="mt-1">
                          <span className="text-xs px-1.5 py-0.5 bg-success-50 text-success-700 rounded">
                            {(candidate.rank * 100).toFixed(0)}% match
                          </span>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Location',
                  accessor: (candidate) => (
                    <div className="text-sm text-gray-700">
                      {[candidate.city, candidate.state, candidate.country].filter(Boolean).join(', ') ||
                        '—'}
                    </div>
                  ),
                },
                {
                  header: 'Applications',
                  accessor: (candidate) => (
                    <div>
                      <Badge variant="info">
                        {candidate._count.applications} application
                        {candidate._count.applications !== 1 ? 's' : ''}
                      </Badge>
                      {candidate.applications.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {candidate.applications.slice(0, 2).map((app) => (
                            <div key={app.id} className="text-xs text-gray-600">
                              <Link
                                href={`/applications/${app.id}`}
                                className="hover:text-brand-purple"
                              >
                                {app.job.title}
                              </Link>{' '}
                              <span className="text-gray-400">•</span>{' '}
                              <span className="text-gray-500">{app.stage.name}</span>
                            </div>
                          ))}
                          {candidate.applications.length > 2 && (
                            <div className="text-xs text-gray-400">
                              +{candidate.applications.length - 2} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Tags',
                  accessor: (candidate) => (
                    <div className="flex flex-wrap gap-1">
                      {candidate.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-700"
                        >
                          {tag}
                        </span>
                      ))}
                      {candidate.tags.length > 3 && (
                        <span className="text-xs text-gray-400">+{candidate.tags.length - 3}</span>
                      )}
                      {candidate.tags.length === 0 && <span className="text-xs text-gray-400">—</span>}
                    </div>
                  ),
                },
                {
                  header: 'Source',
                  accessor: (candidate) => (
                    <span className="text-sm text-gray-600">
                      {candidate.source ? sourceLabels[candidate.source] || candidate.source : '—'}
                    </span>
                  ),
                },
                {
                  header: 'Updated',
                  mobileLabel: 'Last Updated',
                  accessor: (candidate) => (
                    <span className="text-sm text-gray-600">
                      {new Intl.DateTimeFormat('en', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }).format(new Date(candidate.updatedAt))}
                    </span>
                  ),
                },
                {
                  header: 'Actions',
                  className: 'text-right',
                  accessor: (candidate) => (
                    <Link
                      href={`/candidates/${candidate.id}`}
                      className="text-brand-purple hover:underline text-sm"
                    >
                      View
                    </Link>
                  ),
                },
              ]}
              keyExtractor={(candidate) => candidate.id}
              emptyMessage={
                debouncedQuery
                  ? 'No candidates found matching your search.'
                  : 'No candidates found.'
              }
              onRowClick={(candidate) => (window.location.href = `/candidates/${candidate.id}`)}
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

      {/* Bottom Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={pagination.page <= 1}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
        itemLabel="candidate"
        actions={[
          {
            label: 'Send Email',
            icon: <EnvelopeIcon className="h-4 w-4" />,
            onClick: () => setShowEmailModal(true),
            variant: 'primary',
          },
          {
            label: 'Manage Tags',
            icon: <TagIcon className="h-4 w-4" />,
            onClick: () => setShowTagModal(true),
            variant: 'secondary',
          },
          {
            label: 'Export CSV',
            icon: <ArrowDownTrayIcon className="h-4 w-4" />,
            onClick: handleExport,
            variant: 'secondary',
          },
        ]}
      />

      {/* Modals */}
      {showTagModal && (
        <BulkTagModal
          candidateIds={Array.from(selection.selectedIds)}
          onClose={() => setShowTagModal(false)}
          onSuccess={handleBulkSuccess}
        />
      )}

      {showEmailModal && (
        <BulkEmailModal
          open={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          recipients={selectedCandidatesForEmail}
          onSend={handleBulkEmail}
        />
      )}
    </div>
  );
}
