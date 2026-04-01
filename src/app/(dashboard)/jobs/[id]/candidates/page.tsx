'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  DocumentArrowDownIcon,
  CheckIcon,
  ArrowPathIcon,
  XMarkIcon,
  EllipsisHorizontalIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { BulkEmailModal } from '@/components/email/BulkEmailModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

// Memoized uncontrolled search input - won't re-render when parent state changes
const SearchInput = memo(function SearchInput({ onSearchChange }: { onSearchChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Capture value immediately before it's recycled
    const value = e.target.value;

    // Clear any pending timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Set new debounce timer
    timerRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 1000);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative flex-1 flex items-center border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-brand-purple focus-within:border-brand-purple">
      <MagnifyingGlassIcon className="ml-3 w-5 h-5 text-gray-400 flex-shrink-0" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search candidates..."
        defaultValue=""
        onChange={handleChange}
        className="w-full px-3 py-2 border-0 bg-transparent focus:outline-none focus:ring-0"
      />
    </div>
  );
});

type MatchScore = {
  combinedScore: number;
  keywordScore: number | null;
  embeddingScore: number | null;
};

type Application = {
  id: string;
  status: string;
  source: string | null;
  createdAt: string;
  rating: number | null;
  stageEnteredAt: string | null;
  stage: {
    id: string;
    name: string;
  };
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    tags: string[];
  };
  aiScore: number | null;
  aiScoreBreakdown: {
    resumeFit: number;
    answerCompleteness: number;
    answerQuality: number;
    overallScore: number;
  } | null;
  matchScore: MatchScore | null;
};

type Stage = {
  id: string;
  name: string;
  order: number;
};

type SortField = 'name' | 'stage' | 'applied' | 'rating' | 'stageTime' | 'match';
type SortDir = 'asc' | 'desc';

type Pagination = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
};

export default function JobCandidatesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [applications, setApplications] = useState<Application[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 0,
    hasMore: false,
  });
  const [filters, setFilters] = useState({
    search: '',
    stageId: searchParams.get('stageId') || '',
    status: searchParams.get('status') || '',
    source: '',
    appliedFrom: '',
    appliedTo: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('match'); // Default to AI score
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [bulkActionStageId, setBulkActionStageId] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [rejectAndEmail, setRejectAndEmail] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [pendingRejectSendEmail, setPendingRejectSendEmail] = useState(false);

  // Track current search value for display purposes (e.g., "no results" message)
  const [currentSearch, setCurrentSearch] = useState('');

  // Fetch job data once
  useEffect(() => {
    async function fetchJobData() {
      try {
        const jobRes = await fetch(`/api/jobs/${jobId}`);
        if (jobRes.ok) {
          const jobData = await jobRes.json();
          setStages(jobData.stages || []);
        }
      } catch (err) {
        console.error('Failed to load job data', err);
      }
    }
    fetchJobData();
  }, [jobId]);

  // Stable callback for search changes from the isolated SearchInput component
  const handleSearchChange = useCallback((value: string) => {
    setCurrentSearch(value);
    setFilters((f) => ({ ...f, search: value }));
  }, []);

  // Trigger fetch when filters.search changes (after debounce)
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination((p) => ({ ...p, page: 1 }));
    }
  }, [filters.search, pagination.page]);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      // Map frontend sort field to API sort field
      const apiSortBy = sortField === 'match' ? 'aiScore' : sortField === 'applied' ? 'createdAt' : sortField;

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy: apiSortBy,
        sortDir,
      });

      if (filters.stageId) params.set('stageId', filters.stageId);
      if (filters.status) params.set('status', filters.status);
      if (filters.source) params.set('source', filters.source);
      if (filters.search) params.set('search', filters.search);
      if (filters.appliedFrom) params.set('appliedFrom', filters.appliedFrom);
      if (filters.appliedTo) params.set('appliedTo', filters.appliedTo);

      const res = await fetch(`/api/jobs/${jobId}/candidates?${params}`);
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
        setPagination((p) => ({ ...p, ...data.pagination }));
      }
    } catch (err) {
      console.error('Failed to load candidates', err);
    } finally {
      setLoading(false);
    }
  }, [
    jobId,
    pagination.page,
    pagination.limit,
    sortField,
    sortDir,
    filters.stageId,
    filters.status,
    filters.source,
    filters.search,
    filters.appliedFrom,
    filters.appliedTo,
  ]);

  // Fetch candidates when filters/sort/page change
  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  async function fetchData() {
    await fetchCandidates();
  }

  // Applications are now filtered and sorted server-side
  const filteredApplications = applications;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    // Reset to page 1 when sort changes
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredApplications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApplications.map((a) => a.id)));
    }
  };

  async function bulkMoveStage() {
    if (!bulkActionStageId || selectedIds.size === 0) return;

    try {
      await fetch('/api/applications/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationIds: Array.from(selectedIds),
          stageId: bulkActionStageId,
        }),
      });
      setSelectedIds(new Set());
      setBulkActionStageId('');
      await fetchData();
    } catch (err) {
      console.error('Failed to move candidates', err);
    }
  }

  function initiateReject(sendEmail: boolean = false) {
    if (selectedIds.size === 0) return;
    setPendingRejectSendEmail(sendEmail);
    setShowRejectConfirm(true);
  }

  async function bulkReject(sendEmail: boolean = false) {
    if (selectedIds.size === 0) return;

    try {
      await fetch('/api/applications/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationIds: Array.from(selectedIds),
          status: 'REJECTED',
        }),
      });

      if (sendEmail) {
        // Open email modal with rejection template pre-selected
        setRejectAndEmail(true);
        setShowEmailModal(true);
      } else {
        setSelectedIds(new Set());
      }
      await fetchData();
    } catch (err) {
      console.error('Failed to reject candidates', err);
    }
  }

  // Get selected applications for email modal
  const selectedRecipientsForEmail = filteredApplications
    .filter((a) => selectedIds.has(a.id))
    .map((a) => ({
      id: a.candidate.id,
      name: `${a.candidate.firstName} ${a.candidate.lastName}`,
      email: a.candidate.email,
      jobTitle: undefined, // Could add job title here if needed
    }));

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

    setSelectedIds(new Set());
  }

  function getDaysInStage(stageEnteredAt: string | null) {
    if (!stageEnteredAt) return null;
    const days = Math.floor(
      (Date.now() - new Date(stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  }

  const statusColors: Record<string, 'success' | 'warning' | 'neutral' | 'error'> = {
    ACTIVE: 'success',
    HIRED: 'neutral',
    REJECTED: 'error',
    WITHDRAWN: 'warning',
  };

  // Pagination controls component
  const PaginationControls = () => (
    pagination.totalPages > 1 ? (
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            disabled={pagination.page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-700">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            disabled={!pagination.hasMore}
          >
            Next
          </Button>
        </div>
        <select
          value={pagination.limit}
          onChange={(e) =>
            setPagination((p) => ({ ...p, limit: parseInt(e.target.value, 10), page: 1 }))
          }
          className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
        >
          <option value="25">25 per page</option>
          <option value="50">50 per page</option>
          <option value="100">100 per page</option>
        </select>
      </div>
    ) : null
  );

  // Show initial loading spinner only on first load (no applications yet)
  const isInitialLoad = loading && applications.length === 0;

  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            Candidates
            <span className="text-gray-500 font-normal">
              ({pagination.totalCount})
            </span>
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-purple"></div>
            )}
          </h2>
          {pagination.totalPages > 1 && (
            <p className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <DocumentArrowDownIcon className="w-4 h-4 mr-1.5" />
            Export
          </Button>
          <Button size="sm">
            <PlusIcon className="w-4 h-4 mr-1.5" />
            Add Candidate
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-brand-purple/5 border border-brand-purple/20 rounded-lg">
          <span className="text-sm font-medium text-brand-purple">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2 flex-1">
            <select
              value={bulkActionStageId}
              onChange={(e) => setBulkActionStageId(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
            >
              <option value="">Move to stage...</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
            {bulkActionStageId && (
              <Button size="sm" onClick={bulkMoveStage}>
                <ArrowPathIcon className="w-4 h-4 mr-1" />
                Move
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => { setRejectAndEmail(false); setShowEmailModal(true); }}>
              <EnvelopeIcon className="w-4 h-4 mr-1" />
              Email
            </Button>
            <Button size="sm" variant="outline" onClick={() => initiateReject(false)}>
              <XMarkIcon className="w-4 h-4 mr-1" />
              Reject
            </Button>
            <Button size="sm" variant="outline" onClick={() => initiateReject(true)} className="text-danger-600 border-danger-300 hover:bg-danger-50">
              <XMarkIcon className="w-4 h-4 mr-1" />
              Reject & Email
            </Button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput onSearchChange={handleSearchChange} />
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className={showFilters ? 'bg-gray-100' : ''}
        >
          <FunnelIcon className="w-4 h-4 mr-1.5" />
          Filters
          <ChevronDownIcon
            className={`w-4 h-4 ml-1.5 transition-transform ${
              showFilters ? 'rotate-180' : ''
            }`}
          />
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                <select
                  value={filters.stageId}
                  onChange={(e) => setFilters({ ...filters, stageId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                >
                  <option value="">All stages</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                >
                  <option value="">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="HIRED">Hired</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="WITHDRAWN">Withdrawn</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <select
                  value={filters.source}
                  onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                >
                  <option value="">All sources</option>
                  <option value="CAREER_PAGE">Career Page</option>
                  <option value="LINKEDIN">LinkedIn</option>
                  <option value="INDEED">Indeed</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="AGENCY">Agency</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applied From</label>
                <input
                  type="date"
                  value={filters.appliedFrom}
                  onChange={(e) => setFilters({ ...filters, appliedFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applied To</label>
                <input
                  type="date"
                  value={filters.appliedTo}
                  onChange={(e) => setFilters({ ...filters, appliedTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                />
              </div>
            </div>
            {/* Quick date range buttons */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const today = new Date();
                  const thirtyDaysAgo = new Date(today);
                  thirtyDaysAgo.setDate(today.getDate() - 30);
                  setFilters({
                    ...filters,
                    appliedFrom: thirtyDaysAgo.toISOString().split('T')[0],
                    appliedTo: today.toISOString().split('T')[0],
                  });
                }}
                className="px-3 py-1 text-xs font-medium text-brand-purple bg-brand-purple/10 rounded-full hover:bg-brand-purple/20 transition-colors"
              >
                Last 30 days
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const sevenDaysAgo = new Date(today);
                  sevenDaysAgo.setDate(today.getDate() - 7);
                  setFilters({
                    ...filters,
                    appliedFrom: sevenDaysAgo.toISOString().split('T')[0],
                    appliedTo: today.toISOString().split('T')[0],
                  });
                }}
                className="px-3 py-1 text-xs font-medium text-brand-purple bg-brand-purple/10 rounded-full hover:bg-brand-purple/20 transition-colors"
              >
                Last 7 days
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  setFilters({
                    ...filters,
                    appliedFrom: today.toISOString().split('T')[0],
                    appliedTo: today.toISOString().split('T')[0],
                  });
                }}
                className="px-3 py-1 text-xs font-medium text-brand-purple bg-brand-purple/10 rounded-full hover:bg-brand-purple/20 transition-colors"
              >
                Today
              </button>
            </div>
            {(filters.stageId || filters.status || filters.source || filters.appliedFrom || filters.appliedTo) && (
              <button
                onClick={() => setFilters({ ...filters, stageId: '', status: '', source: '', appliedFrom: '', appliedTo: '' })}
                className="mt-4 text-sm text-brand-purple hover:underline"
              >
                Clear filters
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Candidates Table */}
      <Card>
        {/* Top Pagination */}
        <PaginationControls />
        {pagination.totalPages > 1 && <div className="border-b border-gray-200" />}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      filteredApplications.length > 0 &&
                      selectedIds.size === filteredApplications.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => toggleSort('name')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                  >
                    Candidate
                    <ChevronUpDownIcon className="w-4 h-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left hidden md:table-cell">
                  <button
                    onClick={() => toggleSort('stage')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                  >
                    Stage
                    <ChevronUpDownIcon className="w-4 h-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">
                  <button
                    onClick={() => toggleSort('stageTime')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                  >
                    Days in Stage
                    <ChevronUpDownIcon className="w-4 h-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">
                  <button
                    onClick={() => toggleSort('applied')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                  >
                    Applied
                    <ChevronUpDownIcon className="w-4 h-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left hidden xl:table-cell">
                  <button
                    onClick={() => toggleSort('match')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                    title="AI-generated score based on resume fit, answer quality, and completeness"
                  >
                    AI Score
                    <ChevronUpDownIcon className="w-4 h-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredApplications.length > 0 ? (
                filteredApplications.map((app) => {
                  const daysInStage = getDaysInStage(app.stageEnteredAt);
                  return (
                    <tr
                      key={app.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        selectedIds.has(app.id) ? 'bg-brand-purple/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(app.id)}
                          onChange={() => toggleSelect(app.id)}
                          className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/applications/${app.id}`}
                          className="flex items-center gap-3 group"
                        >
                          <div className="w-9 h-9 rounded-full bg-brand-purple/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-brand-purple">
                              {app.candidate.firstName[0]}
                              {app.candidate.lastName[0]}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 group-hover:text-brand-purple truncate">
                              {app.candidate.firstName} {app.candidate.lastName}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {app.candidate.email}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-gray-900">{app.stage.name}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {daysInStage !== null ? (
                          <span
                            className={`text-sm ${
                              daysInStage > 7 ? 'text-warning-600 font-medium' : 'text-gray-500'
                            }`}
                          >
                            {daysInStage}d
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-sm text-gray-500">
                          {new Date(app.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {app.matchScore ? (
                          <div className="relative group flex items-center gap-1.5">
                            <div
                              className={`px-2 py-0.5 rounded text-xs font-semibold cursor-help ${
                                app.matchScore.combinedScore >= 70
                                  ? 'bg-success-100 text-success-700'
                                  : app.matchScore.combinedScore >= 40
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {app.matchScore.combinedScore}%
                            </div>
                            {app.aiScoreBreakdown && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                <div>Resume Fit: {app.aiScoreBreakdown.resumeFit}/100</div>
                                <div>Answer Quality: {app.aiScoreBreakdown.answerQuality}/100</div>
                                <div>Completeness: {app.aiScoreBreakdown.answerCompleteness}%</div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusColors[app.status] || 'neutral'} className="text-xs">
                          {app.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/applications/${app.id}`}
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                        >
                          <EllipsisHorizontalIcon className="w-5 h-5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-gray-500 mb-4">
                      {currentSearch || filters.stageId || filters.status || filters.source
                        ? 'No candidates match your filters'
                        : 'No candidates yet'}
                    </p>
                    <Button size="sm">
                      <PlusIcon className="w-4 h-4 mr-1.5" />
                      Add First Candidate
                    </Button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        {pagination.totalPages > 1 && <div className="border-t border-gray-200" />}
        <PaginationControls />
      </Card>

      {/* Bulk Email Modal */}
      {showEmailModal && (
        <BulkEmailModal
          open={showEmailModal}
          onClose={() => { setShowEmailModal(false); setRejectAndEmail(false); setSelectedIds(new Set()); }}
          recipients={selectedRecipientsForEmail}
          onSend={handleBulkEmail}
          defaultTemplateType={rejectAndEmail ? 'REJECTION' : undefined}
        />
      )}

      {/* Reject Confirmation Modal */}
      <ConfirmModal
        open={showRejectConfirm}
        onClose={() => setShowRejectConfirm(false)}
        onConfirm={() => {
          setShowRejectConfirm(false);
          bulkReject(pendingRejectSendEmail);
        }}
        title="Confirm Rejection"
        message={`${pendingRejectSendEmail ? 'Reject and send rejection emails to' : 'Reject'} ${selectedIds.size} candidate(s)?`}
        confirmLabel="Reject"
        variant="danger"
      />
    </div>
  );
}
