'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  SparklesIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  CheckCircleIcon,
  UserIcon,
  ChartPieIcon,
  FunnelIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type JobKeyword = {
  id: string;
  keyword: string;
  expansions: string[];
  weight: number;
  createdAt: string;
  updatedAt: string;
};

type Job = {
  id: string;
  title: string;
  description: string | null;
};

type RankedCandidate = {
  candidateId: string;
  candidate?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  keywordScore: number | null;
  embeddingScore: number | null;
  combinedScore: number;
  matchedKeywords: Record<string, number> | null;
};

type MatchingAnalytics = {
  totalCandidates: number;
  scoreDistribution: {
    excellent: number;
    good: number;
    fair: number;
    low: number;
    poor: number;
  };
  averageScores: {
    combined: number;
    keyword: number;
    embedding: number;
  };
  keywordEffectiveness: {
    keyword: string;
    weight: number;
    candidatesMatched: number;
    totalHits: number;
    matchRate: number;
  }[];
  embeddingCoverage: {
    candidatesTotal: number;
    candidatesWithEmbedding: number;
    jobHasEmbedding: boolean;
    coveragePercent: number;
  };
};

export default function MatchingPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [keywords, setKeywords] = useState<JobKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New keyword form
  const [newKeyword, setNewKeyword] = useState('');
  const [expandingKeyword, setExpandingKeyword] = useState<string | null>(null);

  // Ranking state
  const [ranking, setRanking] = useState(false);
  const [rankingStep, setRankingStep] = useState('');
  const [rankedCandidates, setRankedCandidates] = useState<RankedCandidate[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [resultsStale, setResultsStale] = useState(false);
  const [lastRankedAt, setLastRankedAt] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<MatchingAnalytics | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [loadingPage, setLoadingPage] = useState(false);
  const pageSize = 50;

  // Date filter state
  const [dateFilters, setDateFilters] = useState({
    appliedFrom: '',
    appliedTo: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleteKeywordConfirm, setShowDeleteKeywordConfirm] = useState(false);
  const [pendingDeleteKeywordId, setPendingDeleteKeywordId] = useState<string | null>(null);

  const totalPages = Math.ceil(totalCandidates / pageSize);

  // Helper to fetch candidate details for a list of matches
  const fetchCandidateDetails = async (matches: RankedCandidate[]): Promise<RankedCandidate[]> => {
    const candidatesWithDetails: RankedCandidate[] = [];
    for (const match of matches) {
      try {
        const candidateRes = await fetch(`/api/candidates/${match.candidateId}`);
        if (candidateRes.ok) {
          const candidateData = await candidateRes.json();
          candidatesWithDetails.push({
            ...match,
            candidate: {
              firstName: candidateData.candidate.firstName,
              lastName: candidateData.candidate.lastName,
              email: candidateData.candidate.email,
            },
          });
        } else {
          candidatesWithDetails.push(match);
        }
      } catch {
        candidatesWithDetails.push(match);
      }
    }
    return candidatesWithDetails;
  };

  // Fetch a specific page of results
  const fetchPage = async (page: number, filters?: { appliedFrom?: string; appliedTo?: string }) => {
    setLoadingPage(true);
    try {
      const offset = (page - 1) * pageSize;
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
      });
      const activeFilters = filters || dateFilters;
      if (activeFilters.appliedFrom) params.set('appliedFrom', activeFilters.appliedFrom);
      if (activeFilters.appliedTo) params.set('appliedTo', activeFilters.appliedTo);

      const rankingRes = await fetch(`/api/jobs/${jobId}/matching?${params}`);
      if (rankingRes.ok) {
        const rankData = await rankingRes.json();
        setTotalCandidates(rankData.total || 0);
        const candidatesWithDetails = await fetchCandidateDetails(rankData.candidates || []);
        setRankedCandidates(candidatesWithDetails);
        setCurrentPage(page);
        setLastRankedAt(rankData.lastUpdated || null);
      }
    } catch (err) {
      setError('Failed to load page');
    } finally {
      setLoadingPage(false);
    }
  };

  // Fetch job, keywords, and cached ranking results
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Build matching URL with date filters
      const matchingParams = new URLSearchParams({ limit: '50' });
      if (dateFilters.appliedFrom) matchingParams.set('appliedFrom', dateFilters.appliedFrom);
      if (dateFilters.appliedTo) matchingParams.set('appliedTo', dateFilters.appliedTo);

      const [jobRes, keywordsRes, rankingRes, analyticsRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}`),
        fetch(`/api/jobs/${jobId}/keywords`),
        fetch(`/api/jobs/${jobId}/matching?${matchingParams}`),
        fetch(`/api/jobs/${jobId}/matching/analytics`),
      ]);

      if (jobRes.ok) {
        const data = await jobRes.json();
        setJob(data.job);
      }

      if (keywordsRes.ok) {
        const data = await keywordsRes.json();
        setKeywords(data.keywords || []);
      }

      // Load cached ranking results
      if (rankingRes.ok) {
        const rankData = await rankingRes.json();
        setTotalCandidates(rankData.total || 0);
        if (rankData.candidates && rankData.candidates.length > 0) {
          // Fetch candidate details for cached results
          const candidatesWithDetails = await fetchCandidateDetails(rankData.candidates);
          setRankedCandidates(candidatesWithDetails);
          setShowResults(true);
          setLastRankedAt(rankData.lastUpdated || null);
          setResultsStale(false);
        }
      }

      // Load analytics
      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [jobId, dateFilters.appliedFrom, dateFilters.appliedTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Add new keyword with AI expansion (gracefully handles missing OpenAI)
  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;

    const keyword = newKeyword.trim().toLowerCase();
    setExpandingKeyword(keyword);
    setError(null);

    try {
      // Try to get AI expansions (may fail if OpenAI not configured)
      let expansions: string[] = [];
      try {
        const expansionRes = await fetch('/api/ai/keyword-expansion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyword,
            jobTitle: job?.title,
            jobDescription: job?.description,
          }),
        });
        if (expansionRes.ok) {
          const data = await expansionRes.json();
          expansions = data.expansions || [];
        }
        // Silently continue without expansions if API fails
      } catch {
        // OpenAI not available, continue without expansions
      }

      // Save the keyword (works even without expansions)
      const saveRes = await fetch(`/api/jobs/${jobId}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, expansions, weight: 5 }),
      });

      if (saveRes.ok) {
        const data = await saveRes.json();
        setKeywords((prev) => [...prev, data.keyword]);
        setNewKeyword('');
        if (rankedCandidates.length > 0) setResultsStale(true);
      } else {
        const err = await saveRes.json();
        setError(err.error || 'Failed to add keyword');
      }
    } catch (err) {
      setError('Failed to add keyword');
    } finally {
      setExpandingKeyword(null);
    }
  };

  // Update keyword weight
  const handleUpdateWeight = async (keywordId: string, weight: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/keywords`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywordId, weight }),
      });

      if (res.ok) {
        const data = await res.json();
        setKeywords((prev) =>
          prev.map((k) => (k.id === keywordId ? data.keyword : k))
        );
        if (rankedCandidates.length > 0) setResultsStale(true);
      }
    } catch (err) {
      setError('Failed to update weight');
    } finally {
      setSaving(false);
    }
  };

  // Remove expansion from keyword
  const handleRemoveExpansion = async (keywordId: string, expansion: string) => {
    const keyword = keywords.find((k) => k.id === keywordId);
    if (!keyword) return;

    const newExpansions = keyword.expansions.filter((e) => e !== expansion);

    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/keywords`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywordId, expansions: newExpansions }),
      });

      if (res.ok) {
        const data = await res.json();
        setKeywords((prev) =>
          prev.map((k) => (k.id === keywordId ? data.keyword : k))
        );
        if (rankedCandidates.length > 0) setResultsStale(true);
      }
    } catch (err) {
      setError('Failed to remove expansion');
    } finally {
      setSaving(false);
    }
  };

  // Regenerate expansions for a keyword
  const handleRegenerateExpansions = async (keywordId: string) => {
    const keyword = keywords.find((k) => k.id === keywordId);
    if (!keyword) return;

    setExpandingKeyword(keyword.keyword);
    try {
      const expansionRes = await fetch('/api/ai/keyword-expansion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.keyword,
          jobTitle: job?.title,
          jobDescription: job?.description,
        }),
      });

      if (expansionRes.ok) {
        const data = await expansionRes.json();
        const newExpansions = data.expansions || [];

        const saveRes = await fetch(`/api/jobs/${jobId}/keywords`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywordId, expansions: newExpansions }),
        });

        if (saveRes.ok) {
          const savedData = await saveRes.json();
          setKeywords((prev) =>
            prev.map((k) => (k.id === keywordId ? savedData.keyword : k))
          );
          if (rankedCandidates.length > 0) setResultsStale(true);
        }
      }
    } catch (err) {
      setError('Failed to regenerate expansions');
    } finally {
      setExpandingKeyword(null);
    }
  };

  const initiateDeleteKeyword = (keywordId: string) => {
    setPendingDeleteKeywordId(keywordId);
    setShowDeleteKeywordConfirm(true);
  };

  // Delete keyword
  const handleDeleteKeyword = async (keywordId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/keywords?keywordId=${keywordId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setKeywords((prev) => prev.filter((k) => k.id !== keywordId));
        if (rankedCandidates.length > 0) setResultsStale(true);
      }
    } catch (err) {
      setError('Failed to delete keyword');
    }
  };

  // Rank candidates (works with or without OpenAI - keyword matching always works)
  const handleRankCandidates = async () => {
    if (keywords.length === 0) {
      setError('Add at least one keyword before ranking candidates');
      return;
    }

    setRanking(true);
    setError(null);
    setRankedCandidates([]);
    setCurrentPage(1);

    try {
      // Step 1: Try to update job embedding (optional - may fail without OpenAI)
      setRankingStep('Preparing job profile...');
      try {
        await fetch(`/api/jobs/${jobId}/embedding`, { method: 'POST' });
      } catch {
        // Embedding failed - continue with keyword-only matching
      }

      // Step 2: Compute match scores for all candidates
      setRankingStep('Computing match scores...');
      const matchRes = await fetch(`/api/jobs/${jobId}/matching`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshAll: true }),
      });

      if (!matchRes.ok) {
        const errorData = await matchRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to compute match scores');
      }

      const matchData = await matchRes.json();

      // Step 3: Get ranked results (first page)
      setRankingStep('Loading ranked candidates...');
      const rankParams = new URLSearchParams({ limit: pageSize.toString() });
      if (dateFilters.appliedFrom) rankParams.set('appliedFrom', dateFilters.appliedFrom);
      if (dateFilters.appliedTo) rankParams.set('appliedTo', dateFilters.appliedTo);
      const rankRes = await fetch(`/api/jobs/${jobId}/matching?${rankParams}`);

      if (!rankRes.ok) {
        throw new Error('Failed to load ranked candidates');
      }

      const rankData = await rankRes.json();
      setTotalCandidates(rankData.total || 0);

      // Fetch candidate details for each result
      const candidatesWithDetails = await fetchCandidateDetails(rankData.candidates || []);

      setRankedCandidates(candidatesWithDetails);
      setShowResults(true);
      setResultsStale(false);
      setLastRankedAt(new Date().toISOString());
      setRankingStep(`Ranked ${matchData.updated || candidatesWithDetails.length} candidates`);
    } catch (err) {
      setError((err as Error).message || 'Failed to rank candidates');
    } finally {
      setRanking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <SparklesIcon className="w-6 h-6 text-brand-purple" />
            Candidate Matching
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Configure keywords for AI-powered candidate ranking
          </p>
        </div>
        <button
          onClick={handleRankCandidates}
          disabled={ranking || keywords.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-purple/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {ranking ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              {rankingStep || 'Ranking...'}
            </>
          ) : (
            <>
              <ChartBarIcon className="w-4 h-4" />
              Rank Candidates
            </>
          )}
        </button>
      </div>

      {/* Date Filters */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
            showFilters || dateFilters.appliedFrom || dateFilters.appliedTo
              ? 'bg-brand-purple/5 border-brand-purple text-brand-purple'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FunnelIcon className="w-4 h-4" />
          Filter by Date
          {(dateFilters.appliedFrom || dateFilters.appliedTo) && (
            <span className="ml-1 px-1.5 py-0.5 bg-brand-purple text-white text-xs rounded-full">
              1
            </span>
          )}
          <ChevronDownIcon
            className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
          />
        </button>
        {(dateFilters.appliedFrom || dateFilters.appliedTo) && (
          <span className="text-sm text-gray-600">
            Showing candidates who applied{' '}
            {dateFilters.appliedFrom && dateFilters.appliedTo
              ? `${new Date(dateFilters.appliedFrom).toLocaleDateString()} - ${new Date(dateFilters.appliedTo).toLocaleDateString()}`
              : dateFilters.appliedFrom
              ? `after ${new Date(dateFilters.appliedFrom).toLocaleDateString()}`
              : `before ${new Date(dateFilters.appliedTo).toLocaleDateString()}`}
          </span>
        )}
      </div>

      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Applied From</label>
              <input
                type="date"
                value={dateFilters.appliedFrom}
                onChange={(e) => {
                  setDateFilters({ ...dateFilters, appliedFrom: e.target.value });
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Applied To</label>
              <input
                type="date"
                value={dateFilters.appliedTo}
                onChange={(e) => {
                  setDateFilters({ ...dateFilters, appliedTo: e.target.value });
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple text-sm"
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
                setDateFilters({
                  appliedFrom: thirtyDaysAgo.toISOString().split('T')[0],
                  appliedTo: today.toISOString().split('T')[0],
                });
                setCurrentPage(1);
              }}
              className="px-3 py-1 text-xs font-medium text-brand-purple bg-brand-purple/10 rounded-full hover:bg-brand-purple/20 transition-colors"
            >
              Last 30 days
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const sixtyDaysAgo = new Date(today);
                sixtyDaysAgo.setDate(today.getDate() - 60);
                setDateFilters({
                  appliedFrom: sixtyDaysAgo.toISOString().split('T')[0],
                  appliedTo: today.toISOString().split('T')[0],
                });
                setCurrentPage(1);
              }}
              className="px-3 py-1 text-xs font-medium text-brand-purple bg-brand-purple/10 rounded-full hover:bg-brand-purple/20 transition-colors"
            >
              Last 60 days
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const sevenDaysAgo = new Date(today);
                sevenDaysAgo.setDate(today.getDate() - 7);
                setDateFilters({
                  appliedFrom: sevenDaysAgo.toISOString().split('T')[0],
                  appliedTo: today.toISOString().split('T')[0],
                });
                setCurrentPage(1);
              }}
              className="px-3 py-1 text-xs font-medium text-brand-purple bg-brand-purple/10 rounded-full hover:bg-brand-purple/20 transition-colors"
            >
              Last 7 days
            </button>
            <button
              onClick={() => {
                const today = new Date();
                setDateFilters({
                  appliedFrom: today.toISOString().split('T')[0],
                  appliedTo: today.toISOString().split('T')[0],
                });
                setCurrentPage(1);
              }}
              className="px-3 py-1 text-xs font-medium text-brand-purple bg-brand-purple/10 rounded-full hover:bg-brand-purple/20 transition-colors"
            >
              Today
            </button>
          </div>
          {(dateFilters.appliedFrom || dateFilters.appliedTo) && (
            <button
              onClick={() => {
                setDateFilters({ appliedFrom: '', appliedTo: '' });
                setCurrentPage(1);
              }}
              className="mt-3 text-sm text-brand-purple hover:underline"
            >
              Clear date filters
            </button>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 flex items-center gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-danger-500" />
          <span className="text-danger-700">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-danger-500 hover:text-danger-700"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Add keyword */}
      <Card>
        <CardHeader title="Add Keyword" subtitle="Enter a skill or term to match candidates" />
        <CardContent>
          <div className="flex gap-3">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="e.g., actor, teacher, chess, python"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
              disabled={!!expandingKeyword}
            />
            <button
              onClick={handleAddKeyword}
              disabled={!newKeyword.trim() || !!expandingKeyword}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-purple/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {expandingKeyword === newKeyword.trim().toLowerCase() ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Expanding...
                </>
              ) : (
                <>
                  <PlusIcon className="w-4 h-4" />
                  Add Keyword
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            AI will automatically suggest related terms and synonyms based on the job context.
          </p>
        </CardContent>
      </Card>

      {/* Keywords list */}
      <Card>
        <CardHeader
          title={`Keywords (${keywords.length})`}
          subtitle="Ranked by importance. Higher weights have more influence on matching."
        />
        <CardContent>
          {keywords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <SparklesIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No keywords configured yet.</p>
              <p className="text-sm">Add keywords above to start matching candidates.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {keywords
                .sort((a, b) => b.weight - a.weight)
                .map((kw) => (
                  <div
                    key={kw.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-semibold text-gray-900">
                            {kw.keyword}
                          </span>
                          <Badge variant="info">Weight: {kw.weight}</Badge>
                        </div>

                        {/* Expansions */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {kw.expansions.map((exp) => (
                            <span
                              key={exp}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-sm"
                            >
                              {exp}
                              <button
                                onClick={() => handleRemoveExpansion(kw.id, exp)}
                                className="hover:text-purple-900 ml-1"
                              >
                                <XMarkIcon className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          {kw.expansions.length === 0 && (
                            <span className="text-sm text-gray-400 italic">
                              No expansions
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Weight slider */}
                      <div className="flex flex-col items-center gap-1 min-w-[80px]">
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={kw.weight}
                          onChange={(e) =>
                            handleUpdateWeight(kw.id, parseInt(e.target.value))
                          }
                          className="w-full accent-brand-purple"
                        />
                        <span className="text-xs text-gray-500">Importance</span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRegenerateExpansions(kw.id)}
                          disabled={expandingKeyword === kw.keyword}
                          className="p-2 text-gray-400 hover:text-brand-purple hover:bg-purple-50 rounded transition-colors"
                          title="Regenerate expansions"
                        >
                          <ArrowPathIcon
                            className={`w-5 h-5 ${
                              expandingKeyword === kw.keyword ? 'animate-spin' : ''
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => initiateDeleteKeyword(kw.id)}
                          className="p-2 text-gray-400 hover:text-danger-500 hover:bg-danger-50 rounded transition-colors"
                          title="Delete keyword"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ranked Results */}
      {showResults && rankedCandidates.length > 0 && (
        <Card>
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                {resultsStale ? (
                  <ExclamationTriangleIcon className="w-5 h-5 text-warning-500" />
                ) : (
                  <CheckCircleIcon className="w-5 h-5 text-success-500" />
                )}
                Matching Candidates
                <span className="text-sm font-normal text-gray-500">
                  ({totalCandidates > 0 ? `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalCandidates)} of ${totalCandidates}` : '0'})
                </span>
                {resultsStale && (
                  <Badge variant="warning" size="sm">
                    Stale
                  </Badge>
                )}
              </div>
            }
            subtitle={
              <span className="flex items-center gap-2">
                Ranked by combined keyword and semantic match scores
                {lastRankedAt && (
                  <span className="text-gray-400">
                    · Last ranked {new Date(lastRankedAt).toLocaleDateString()} at{' '}
                    {new Date(lastRankedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </span>
            }
            action={
              <div className="flex items-center gap-3">
                {resultsStale && (
                  <button
                    onClick={handleRankCandidates}
                    disabled={ranking}
                    className="text-sm text-brand-purple hover:text-brand-purple/80 font-medium"
                  >
                    Re-rank
                  </button>
                )}
                <button
                  onClick={() => setShowResults(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Hide
                </button>
              </div>
            }
          />
          <CardContent>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-200">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchPage(1)}
                    disabled={currentPage === 1 || loadingPage}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    First
                  </button>
                  <button
                    onClick={() => fetchPage(currentPage - 1)}
                    disabled={currentPage === 1 || loadingPage}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-600">
                    {loadingPage ? 'Loading...' : `${currentPage} / ${totalPages}`}
                  </span>
                  <button
                    onClick={() => fetchPage(currentPage + 1)}
                    disabled={currentPage === totalPages || loadingPage}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => fetchPage(totalPages)}
                    disabled={currentPage === totalPages || loadingPage}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {rankedCandidates.map((rc, index) => (
                <div
                  key={rc.candidateId}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-brand-purple text-white font-semibold text-sm">
                    {(currentPage - 1) * pageSize + index + 1}
                  </div>

                  {/* Candidate info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-gray-400" />
                      {rc.candidate ? (
                        <Link
                          href={`/candidates/${rc.candidateId}`}
                          className="font-medium text-gray-900 hover:text-brand-purple"
                        >
                          {rc.candidate.firstName} {rc.candidate.lastName}
                        </Link>
                      ) : (
                        <span className="text-gray-500">Candidate {rc.candidateId.slice(0, 8)}</span>
                      )}
                    </div>
                    {rc.candidate?.email && (
                      <p className="text-sm text-gray-500 truncate">{rc.candidate.email}</p>
                    )}
                    {/* Matched keywords */}
                    {rc.matchedKeywords && Object.keys(rc.matchedKeywords).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(rc.matchedKeywords).map(([kw, count]) => (
                          <span
                            key={kw}
                            className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded"
                          >
                            {kw} ({count})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Scores */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-gray-900">{rc.keywordScore ?? '-'}%</div>
                      <div className="text-xs text-gray-500">Keyword</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-gray-900">{rc.embeddingScore ?? '-'}%</div>
                      <div className="text-xs text-gray-500">Semantic</div>
                    </div>
                    <div className="text-center px-3 py-1 bg-brand-purple/10 rounded">
                      <div className="font-bold text-brand-purple text-lg">{rc.combinedScore}%</div>
                      <div className="text-xs text-brand-purple">Match</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No results message */}
      {showResults && rankedCandidates.length === 0 && !ranking && (
        <Card>
          <CardContent>
            <div className="text-center py-6 text-gray-500">
              <UserIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No candidates matched the configured keywords.</p>
              <p className="text-sm mt-1">
                Try adding more keywords or check that candidates have resumes uploaded.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics Section */}
      {analytics && analytics.totalCandidates > 0 && (
        <Card>
          <CardHeader
            title={
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="flex items-center gap-2 w-full text-left"
              >
                <ChartPieIcon className="w-5 h-5 text-brand-purple" />
                Matching Analytics
                <span className="text-sm font-normal text-gray-500">
                  ({analytics.totalCandidates} candidates scored)
                </span>
              </button>
            }
            action={
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {showAnalytics ? 'Hide' : 'Show'}
              </button>
            }
          />
          {showAnalytics && (
            <CardContent>
              <div className="space-y-6">
                {/* Score Distribution */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Score Distribution</h4>
                  <div className="flex gap-2 h-24">
                    {[
                      { label: 'Excellent', value: analytics.scoreDistribution.excellent, color: 'bg-success-500', range: '80-100%' },
                      { label: 'Good', value: analytics.scoreDistribution.good, color: 'bg-lime-500', range: '60-79%' },
                      { label: 'Fair', value: analytics.scoreDistribution.fair, color: 'bg-yellow-500', range: '40-59%' },
                      { label: 'Low', value: analytics.scoreDistribution.low, color: 'bg-warning-500', range: '20-39%' },
                      { label: 'Poor', value: analytics.scoreDistribution.poor, color: 'bg-danger-400', range: '0-19%' },
                    ].map((bar) => {
                      const height = analytics.totalCandidates > 0
                        ? Math.max(5, (bar.value / analytics.totalCandidates) * 100)
                        : 0;
                      return (
                        <div key={bar.label} className="flex-1 flex flex-col items-center justify-end">
                          <div
                            className={`w-full rounded-t ${bar.color} transition-all`}
                            style={{ height: `${height}%` }}
                            title={`${bar.value} candidates`}
                          />
                          <div className="text-xs text-gray-600 mt-1">{bar.value}</div>
                          <div className="text-xs text-gray-400">{bar.range}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Average Scores */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-brand-purple">{analytics.averageScores.combined}%</div>
                    <div className="text-xs text-gray-500">Avg Combined</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-700">{analytics.averageScores.keyword}%</div>
                    <div className="text-xs text-gray-500">Avg Keyword</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-700">{analytics.averageScores.embedding}%</div>
                    <div className="text-xs text-gray-500">Avg Semantic</div>
                  </div>
                </div>

                {/* Keyword Effectiveness */}
                {analytics.keywordEffectiveness.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Keyword Effectiveness</h4>
                    <div className="space-y-2">
                      {analytics.keywordEffectiveness.map((kw) => (
                        <div key={kw.keyword} className="flex items-center gap-3">
                          <div className="w-24 font-medium text-sm text-gray-900 truncate">{kw.keyword}</div>
                          <div className="flex-1">
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-brand-purple rounded-full transition-all"
                                style={{ width: `${kw.matchRate}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 w-16 text-right">{kw.matchRate}%</div>
                          <div className="text-xs text-gray-400 w-20">
                            {kw.candidatesMatched} match{kw.candidatesMatched !== 1 ? 'es' : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Embedding Coverage */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">AI Readiness</h4>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      {analytics.embeddingCoverage.jobHasEmbedding ? (
                        <CheckCircleIcon className="w-4 h-4 text-success-500" />
                      ) : (
                        <ExclamationTriangleIcon className="w-4 h-4 text-warning-500" />
                      )}
                      <span>Job embedding</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">
                        {analytics.embeddingCoverage.candidatesWithEmbedding}/{analytics.embeddingCoverage.candidatesTotal} candidates
                      </span>
                      <span className="text-gray-400">({analytics.embeddingCoverage.coveragePercent}% coverage)</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Delete Keyword Confirmation */}
      <ConfirmModal
        open={showDeleteKeywordConfirm}
        onClose={() => { setShowDeleteKeywordConfirm(false); setPendingDeleteKeywordId(null); }}
        onConfirm={() => {
          setShowDeleteKeywordConfirm(false);
          if (pendingDeleteKeywordId) handleDeleteKeyword(pendingDeleteKeywordId);
          setPendingDeleteKeywordId(null);
        }}
        title="Delete Keyword"
        message="Delete this keyword?"
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Info card */}
      <Card variant="ghost">
        <CardContent>
          <h3 className="font-medium text-gray-900 mb-2">How Matching Works</h3>
          <ul className="text-sm text-gray-600 space-y-1.5">
            <li>
              <strong>Keywords</strong> are the primary terms you want to find in candidate
              profiles (resumes, notes, applications).
            </li>
            <li>
              <strong>Expansions</strong> are AI-generated synonyms and related terms that will
              also match. For example, &quot;actor&quot; expands to &quot;actress&quot;, &quot;performer&quot;, etc.
            </li>
            <li>
              <strong>Weight</strong> (1-10) determines how much each keyword contributes to the
              overall match score. Higher = more important.
            </li>
            <li>
              Candidates will be automatically ranked by how well their profile matches your
              configured keywords.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
