'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  GlobeAltIcon,
  LinkIcon,
  ChartBarIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  InformationCircleIcon,
  EyeIcon,
  BriefcaseIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  BuildingOfficeIcon,
  BoltIcon,
  PencilSquareIcon,
  MagnifyingGlassCircleIcon,
} from '@heroicons/react/24/outline';

type BoardStats = {
  boardType: string;
  boardName: string;
  totalPosts: number;
  livePosts: number;
  applications: number;
  views: number;
  status: 'connected' | 'not_connected' | 'pending';
  lastPostedAt: string | null;
};

type Totals = {
  totalPosts: number;
  livePosts: number;
  applications: number;
  views: number;
  connectedBoards: number;
};

type BoardPost = {
  id: string;
  jobId: string;
  jobTitle: string;
  title: string | null;
  location: string | null;
  status: string;
  applications: number;
  views: number;
  postedAt: string | null;
  expiresAt: string | null;
  externalUrl: string | null;
};

type CareersJob = {
  id: string;
  title: string;
  status: string;
  location: string | null;
  employmentType: string;
  createdAt: string;
  updatedAt: string;
  market: { name: string; slug: string };
  _count: { applications: number };
};

const APP_URL = typeof window !== 'undefined' ? window.location.origin : '';

// Heroicon components for each board type
const BOARD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  INTERNAL: HomeIcon,
  INDEED: GlobeAltIcon,
  LINKEDIN: BriefcaseIcon,
  GOOGLE_JOBS: MagnifyingGlassIcon,
  GLASSDOOR: BuildingOfficeIcon,
  ZIPRECRUITER: BoltIcon,
  OTHER: LinkIcon,
};

const BOARD_CONFIG: Record<
  string,
  {
    color: string;
    bgColor: string;
    description: string;
    feedPath?: string;
    externalUrl?: string;
    setupSteps: string[];
    costType: 'free' | 'paid' | 'freemium';
  }
> = {
  INTERNAL: {
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    description:
      'Your company career page at /careers. Jobs are automatically listed when published.',
    feedPath: '/careers',
    setupSteps: [
      'Jobs appear automatically when status is set to Published',
      'Job posts with board type "Career Page" allow custom titles and descriptions',
      'Share your careers page link: /careers',
    ],
    costType: 'free',
  },
  INDEED: {
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    description:
      'Indeed XML feed for organic and sponsored job listings. Register your feed URL with Indeed Publisher Portal.',
    feedPath: '/api/public/jobs-feed?board=INDEED',
    externalUrl: 'https://employers.indeed.com',
    setupSteps: [
      'Copy the XML Feed URL below',
      'Go to Indeed Publisher Portal (employers.indeed.com)',
      'Register your feed URL under "XML Feed" settings',
      'Indeed will crawl your feed hourly and list jobs automatically',
      'Create job posts with board type "Indeed" for custom titles/descriptions per job',
    ],
    costType: 'freemium',
  },
  LINKEDIN: {
    color: 'text-cyan-800',
    bgColor: 'bg-sky-50',
    description:
      'LinkedIn job postings via the Limited Listings partnership program or manual posting.',
    feedPath: '/api/public/jobs-feed?board=LINKEDIN',
    externalUrl: 'https://linkedin.com/talent',
    setupSteps: [
      'Apply for LinkedIn Limited Listings (free) or use LinkedIn Jobs (paid)',
      'For free listings: submit your XML feed URL below to LinkedIn partner support',
      'For paid postings: post directly on LinkedIn and add the external URL to the job post',
      'LinkedIn Easy Apply webhook is configured for automatic application ingestion',
      'Create job posts with board type "LinkedIn" for custom titles/descriptions',
    ],
    costType: 'freemium',
  },
  GOOGLE_JOBS: {
    color: 'text-success-700',
    bgColor: 'bg-success-50',
    description:
      'Google for Jobs indexes your career pages automatically via JSON-LD structured data. No registration needed.',
    feedPath: '/sitemap.xml',
    setupSteps: [
      'Already configured! Each /careers/[id] page includes JobPosting JSON-LD',
      'Google crawls your sitemap.xml to discover new job pages',
      'Jobs typically appear in Google Search within 1-3 days of publishing',
      'Verify indexing at Google Search Console (search.google.com/search-console)',
    ],
    costType: 'free',
  },
  GLASSDOOR: {
    color: 'text-success-700',
    bgColor: 'bg-success-50',
    description:
      'Glassdoor aggregates from Indeed XML feeds. If your Indeed feed is active, Glassdoor will pick up your jobs automatically.',
    feedPath: '/api/public/jobs-feed?board=GLASSDOOR',
    externalUrl: 'https://employers.glassdoor.com',
    setupSteps: [
      'Glassdoor sources jobs from Indeed XML feeds automatically',
      'Ensure your Indeed feed is active and registered',
      'For direct posting: create an employer account at employers.glassdoor.com',
      'You can also submit your board-specific XML feed URL below directly to Glassdoor partner support',
    ],
    costType: 'free',
  },
  ZIPRECRUITER: {
    color: 'text-warning-700',
    bgColor: 'bg-warning-50',
    description:
      'ZipRecruiter aggregates from Indeed XML feeds and also accepts direct XML feed submissions.',
    feedPath: '/api/public/jobs-feed?board=ZIPRECRUITER',
    externalUrl: 'https://employer.ziprecruiter.com',
    setupSteps: [
      'ZipRecruiter can source from your Indeed XML feed automatically',
      'For direct integration: contact ZipRecruiter partner team with your board-specific feed URL below',
      'For paid postings: create an employer account at employer.ziprecruiter.com',
      'Create job posts with board type "ZipRecruiter" for custom titles/descriptions',
    ],
    costType: 'freemium',
  },
  OTHER: {
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    description:
      'Other job boards and aggregators. Many free aggregators (SimplyHired, Jooble, Adzuna, Talent.com) accept the Indeed XML feed format.',
    setupSteps: [
      'Most free job aggregators accept the same Indeed XML feed format',
      'Submit your XML feed URL to: SimplyHired, Jooble, Adzuna, Talent.com, Neuvoo',
      'For niche boards: create job posts with board type "Other" and add the external URL',
    ],
    costType: 'free',
  },
};

const BOARD_NAMES: Record<string, string> = {
  INTERNAL: 'Career Page',
  INDEED: 'Indeed',
  LINKEDIN: 'LinkedIn',
  GOOGLE_JOBS: 'Google Jobs',
  GLASSDOOR: 'Glassdoor',
  ZIPRECRUITER: 'ZipRecruiter',
  OTHER: 'Other',
};

const COST_BADGES: Record<string, { label: string; variant: 'success' | 'warning' | 'info' }> = {
  free: { label: 'Free', variant: 'success' },
  paid: { label: 'Paid', variant: 'warning' },
  freemium: { label: 'Free + Paid Options', variant: 'info' },
};

export default function JobBoardsPage() {
  const [boards, setBoards] = useState<BoardStats[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [setupModal, setSetupModal] = useState<string | null>(null);

  // Careers page state
  const [careersJobs, setCareersJobs] = useState<CareersJob[]>([]);
  const [careersLoading, setCareersLoading] = useState(true);
  const [careersSearch, setCareersSearch] = useState('');
  const [togglingJobId, setTogglingJobId] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{ jobId: string; jobTitle: string; newStatus: string } | null>(null);

  useEffect(() => {
    fetchBoards();
    fetchCareersJobs();
  }, []);

  async function fetchCareersJobs() {
    setCareersLoading(true);
    try {
      const res = await fetch('/api/configure/job-boards/careers');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCareersJobs(data.jobs);
    } catch {
      // silently fail, boards section still works
    } finally {
      setCareersLoading(false);
    }
  }

  async function handleToggleJobStatus(jobId: string, newStatus: string) {
    setTogglingJobId(jobId);
    setConfirmToggle(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await fetchCareersJobs();
      // Also refresh board stats since counts may change
      await fetchBoards();
    } catch {
      setError('Failed to update job status');
    } finally {
      setTogglingJobId(null);
    }
  }

  const fetchBoardPosts = useCallback(async (boardType: string) => {
    setPostsLoading(true);
    try {
      const response = await fetch(`/api/job-boards/${boardType}/posts`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setBoardPosts(data.posts);
    } catch {
      setBoardPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBoard) {
      fetchBoardPosts(selectedBoard);
    }
  }, [selectedBoard, fetchBoardPosts]);

  async function fetchBoards() {
    try {
      const response = await fetch('/api/job-boards');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setBoards(data.boards);
      setTotals(data.totals);
    } catch {
      setError('Failed to load job board statistics');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  async function copyToClipboard(url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  const filteredCareersJobs = careersJobs.filter((job) => {
    if (!careersSearch) return true;
    const search = careersSearch.toLowerCase();
    return (
      job.title.toLowerCase().includes(search) ||
      job.market.name.toLowerCase().includes(search) ||
      (job.location || '').toLowerCase().includes(search)
    );
  });

  const publishedCount = careersJobs.filter((j) => j.status === 'PUBLISHED').length;

  const selectedBoardConfig = selectedBoard ? BOARD_CONFIG[selectedBoard] : null;
  const selectedBoardStats = selectedBoard
    ? boards.find((b) => b.boardType === selectedBoard)
    : null;

  // Board detail view
  if (selectedBoard && selectedBoardConfig && selectedBoardStats) {
    const feedUrl = selectedBoardConfig.feedPath
      ? `${APP_URL}${selectedBoardConfig.feedPath}`
      : null;
    const BoardIcon = BOARD_ICONS[selectedBoard] || GlobeAltIcon;

    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedBoard(null)}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className={`p-2 ${selectedBoardConfig.bgColor} rounded-lg`}>
                <BoardIcon className={`w-5 h-5 ${selectedBoardConfig.color}`} />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">
                {selectedBoardStats.boardName}
              </h1>
              <Badge
                variant={
                  selectedBoardStats.status === 'connected'
                    ? 'success'
                    : selectedBoardStats.status === 'pending'
                    ? 'warning'
                    : 'neutral'
                }
                dot
              >
                {selectedBoardStats.status === 'connected'
                  ? 'Active'
                  : selectedBoardStats.status === 'pending'
                  ? 'Pending'
                  : 'Not Connected'}
              </Badge>
              <Badge variant={COST_BADGES[selectedBoardConfig.costType].variant} size="sm">
                {COST_BADGES[selectedBoardConfig.costType].label}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">{selectedBoardConfig.description}</p>
          </div>
          {selectedBoardConfig.externalUrl && (
            <a
              href={selectedBoardConfig.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <ArrowTopRightOnSquareIcon className="w-4 h-4 mr-1.5" />
                Open {selectedBoardStats.boardName}
              </Button>
            </a>
          )}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 ${selectedBoardConfig.bgColor} rounded-lg`}>
                  <BriefcaseIcon className={`w-5 h-5 ${selectedBoardConfig.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedBoardStats.livePosts}
                  </p>
                  <p className="text-xs text-gray-500">Live Posts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-50 rounded-lg">
                  <ChartBarIcon className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedBoardStats.totalPosts}
                  </p>
                  <p className="text-xs text-gray-500">Total Posts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success-50 rounded-lg">
                  <EyeIcon className="w-5 h-5 text-success-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedBoardStats.views}
                  </p>
                  <p className="text-xs text-gray-500">Views</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning-50 rounded-lg">
                  <ChartBarIcon className="w-5 h-5 text-warning-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedBoardStats.applications}
                  </p>
                  <p className="text-xs text-gray-500">Applications</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feed URL */}
        {feedUrl && (
          <Card>
            <CardHeader title="Feed URL" />
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 font-mono text-sm text-gray-700 truncate">
                  {feedUrl}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(feedUrl)}
                >
                  {copiedUrl === feedUrl ? (
                    <>
                      <CheckIcon className="w-4 h-4 mr-1.5 text-success-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="w-4 h-4 mr-1.5" />
                      Copy
                    </>
                  )}
                </Button>
                <a href={feedUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">
                    <ArrowTopRightOnSquareIcon className="w-4 h-4 mr-1.5" />
                    Preview
                  </Button>
                </a>
              </div>
              {selectedBoard === 'INDEED' && (
                <p className="text-xs text-gray-500 mt-2">
                  This XML feed is also compatible with Glassdoor, ZipRecruiter, SimplyHired,
                  Jooble, Adzuna, and Talent.com.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Setup Instructions */}
        <Card>
          <CardHeader title="Setup Instructions" />
          <CardContent className="p-4">
            <ol className="space-y-3">
              {selectedBoardConfig.setupSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-700">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Posts for this board */}
        <Card>
          <CardHeader
            title={`Job Posts on ${selectedBoardStats.boardName}`}
            subtitle={`${selectedBoardStats.totalPosts} posts across all jobs`}
          />
          <CardContent className="p-0">
            {postsLoading ? (
              <div className="p-8 text-center text-gray-500">Loading posts...</div>
            ) : boardPosts.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500">No posts on this board yet.</p>
                <p className="text-sm text-gray-400 mt-1">
                  Create posts from the Job Setup &gt; Posts tab on any job.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Post Name</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Location</th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Published</th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {boardPosts.map((post) => (
                      <tr key={post.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              post.status === 'LIVE'
                                ? 'success'
                                : post.status === 'PAUSED'
                                ? 'warning'
                                : 'neutral'
                            }
                            dot
                            size="sm"
                          >
                            {post.status === 'LIVE' ? 'Live' : post.status === 'PAUSED' ? 'Paused' : post.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/jobs/${post.jobId}/setup/posts`}
                            className="font-medium text-gray-900 hover:text-brand-purple text-sm"
                          >
                            {post.title || post.jobTitle}
                          </Link>
                          {post.title && post.title !== post.jobTitle && (
                            <p className="text-xs text-gray-400 mt-0.5">Job: {post.jobTitle}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {post.location || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(post.postedAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {post.externalUrl && (
                              <a href={post.externalUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="sm">
                                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                                </Button>
                              </a>
                            )}
                            <Link href={`/jobs/${post.jobId}/setup/posts`}>
                              <Button variant="ghost" size="sm">
                                <PencilSquareIcon className="w-4 h-4" />
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main boards list view
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Job Boards</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your job board integrations and career page listings
          </p>
        </div>
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Loading job board statistics...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Job Boards</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your job board integrations and career page listings
          </p>
        </div>
        <a href={`${APP_URL}/careers`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <ArrowTopRightOnSquareIcon className="w-4 h-4 mr-1.5" />
            View Careers Page
          </Button>
        </a>
      </div>

      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <LinkIcon className="w-5 h-5 text-brand-purple" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totals.connectedBoards}</p>
                  <p className="text-xs text-gray-500">Active Boards</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success-50 rounded-lg">
                  <GlobeAltIcon className="w-5 h-5 text-success-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{publishedCount}</p>
                  <p className="text-xs text-gray-500">Live on Careers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-50 rounded-lg">
                  <ChartBarIcon className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totals.totalPosts}</p>
                  <p className="text-xs text-gray-500">Board Posts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning-50 rounded-lg">
                  <ChartBarIcon className="w-5 h-5 text-warning-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totals.applications}</p>
                  <p className="text-xs text-gray-500">Applications</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Careers Page Section */}
      <Card>
        <CardHeader
          title="Careers Page"
          subtitle={`${publishedCount} job${publishedCount !== 1 ? 's' : ''} live on your careers page`}
        />
        <CardContent className="p-0">
          {/* Search bar */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="relative">
              <MagnifyingGlassCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={careersSearch}
                onChange={(e) => setCareersSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-purple focus:ring-0"
              />
            </div>
          </div>

          {careersLoading ? (
            <div className="p-8 text-center text-gray-500">Loading jobs...</div>
          ) : filteredCareersJobs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">
                {careersSearch ? 'No jobs match your search.' : 'No jobs found.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Job Title</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Location</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Market</th>
                    <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Candidates</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredCareersJobs.map((job) => {
                    const isPublished = job.status === 'PUBLISHED';
                    const isToggling = togglingJobId === job.id;

                    return (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              if (isPublished) {
                                setConfirmToggle({ jobId: job.id, jobTitle: job.title, newStatus: 'DRAFT' });
                              } else {
                                handleToggleJobStatus(job.id, 'PUBLISHED');
                              }
                            }}
                            disabled={isToggling}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              isPublished
                                ? 'bg-success-50 text-success-700 border-success-200 hover:bg-success-100'
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                            } ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isPublished ? 'bg-success-500' : 'bg-gray-400'}`} />
                            {isToggling ? '...' : isPublished ? 'Live' : 'Off'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="font-medium text-gray-900 hover:text-brand-purple text-sm"
                          >
                            {job.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {job.location || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {job.market.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center font-medium">
                          {job._count.applications}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isPublished && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(`/careers/${job.id}`, '_blank')}
                              >
                                <EyeIcon className="w-4 h-4" />
                              </Button>
                            )}
                            <Link href={`/jobs/${job.id}/setup/posts`}>
                              <Button variant="ghost" size="sm">
                                <PencilSquareIcon className="w-4 h-4" />
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feed URLs Quick Reference */}
      <Card>
        <CardHeader title="Feed URLs" subtitle="Share these URLs with job boards and aggregators" />
        <CardContent className="p-4 space-y-3">
          {[
            { label: 'Universal XML Feed', path: '/api/public/jobs-feed', note: 'Works for all aggregators. Add ?board=INDEED for board-specific content' },
            { label: 'Indeed Feed', path: '/api/public/jobs-feed?board=INDEED', note: 'Uses Indeed-specific post titles and descriptions when available' },
            { label: 'LinkedIn Feed', path: '/api/public/jobs-feed?board=LINKEDIN', note: 'Submit to LinkedIn Limited Listings partner support' },
            { label: 'Sitemap (Google Jobs)', path: '/sitemap.xml', note: 'Auto-indexed by Google for Jobs via JSON-LD structured data' },
            { label: 'Career Page', path: '/careers', note: 'Your public career page listing all published jobs' },
          ].map((feed) => (
            <div key={feed.path} className="flex items-center gap-3">
              <div className="w-48 flex-shrink-0">
                <p className="text-sm font-medium text-gray-900">{feed.label}</p>
                <p className="text-xs text-gray-400">{feed.note}</p>
              </div>
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-mono text-xs text-gray-600 truncate">
                {APP_URL}{feed.path}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(`${APP_URL}${feed.path}`)}
              >
                {copiedUrl === `${APP_URL}${feed.path}` ? (
                  <CheckIcon className="w-4 h-4 text-success-600" />
                ) : (
                  <ClipboardDocumentIcon className="w-4 h-4" />
                )}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Job Boards List */}
      <Card>
        <CardHeader title="External Job Boards" subtitle="Click a board to view posts, feed URLs, and setup instructions" />
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {boards.map((board) => {
              const config = BOARD_CONFIG[board.boardType];
              const costBadge = config ? COST_BADGES[config.costType] : null;
              const BoardIcon = BOARD_ICONS[board.boardType] || GlobeAltIcon;

              return (
                <button
                  key={board.boardType}
                  onClick={() => setSelectedBoard(board.boardType)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 ${config?.bgColor || 'bg-gray-50'} rounded-lg`}>
                      <BoardIcon className={`w-5 h-5 ${config?.color || 'text-gray-500'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{board.boardName}</span>
                        <Badge
                          variant={
                            board.status === 'connected'
                              ? 'success'
                              : board.status === 'pending'
                              ? 'warning'
                              : 'neutral'
                          }
                          dot
                          size="sm"
                        >
                          {board.status === 'connected'
                            ? 'Active'
                            : board.status === 'pending'
                            ? 'Pending'
                            : 'Not Connected'}
                        </Badge>
                        {costBadge && (
                          <Badge variant={costBadge.variant} size="sm">
                            {costBadge.label}
                          </Badge>
                        )}
                      </div>
                      {board.status === 'connected' ? (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {board.livePosts} live &middot; {board.totalPosts} total posts &middot;{' '}
                          {board.applications} applications
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400 mt-0.5">
                          {config?.description
                            ? config.description.split('.')[0] + '.'
                            : 'No posts yet'}
                        </p>
                      )}
                      {board.lastPostedAt && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Last posted: {formatDate(board.lastPostedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Setup Tip */}
      <div className="flex items-start gap-3 p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
        <InformationCircleIcon className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-cyan-900">Quick Setup Tip</p>
          <p className="text-sm text-cyan-700 mt-1">
            Most free job aggregators (Glassdoor, SimplyHired, Jooble, Adzuna, Talent.com) accept
            the same Indeed XML feed format. Register your Indeed feed URL with each to maximize
            visibility at no cost.
          </p>
        </div>
      </div>

      {/* Unpublish Confirmation Modal */}
      <ConfirmModal
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={() => {
          if (confirmToggle) {
            handleToggleJobStatus(confirmToggle.jobId, confirmToggle.newStatus);
          }
        }}
        title="Unpublish from Careers Page"
        message={`This will remove "${confirmToggle?.jobTitle}" from your careers page. Candidates won't be able to find or apply to this job. You can republish at any time.`}
        confirmLabel="Turn Off"
        variant="danger"
      />

      {/* Setup Modal */}
      {setupModal && BOARD_CONFIG[setupModal] && (
        <Modal
          open={!!setupModal}
          onClose={() => setSetupModal(null)}
          title={`Setup ${BOARD_NAMES[setupModal] || setupModal}`}
        >
          <ol className="space-y-3">
            {BOARD_CONFIG[setupModal].setupSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700">{step}</span>
              </li>
            ))}
          </ol>
        </Modal>
      )}
    </div>
  );
}
