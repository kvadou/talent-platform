'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { BulkEmailModal } from '@/components/email/BulkEmailModal';
import {
  BriefcaseIcon,
  UsersIcon,
  CalendarIcon,
  CheckCircleIcon,
  XMarkIcon,
  EnvelopeIcon,
  PhoneIcon,
  ClockIcon,
  StarIcon,
  ChevronRightIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface Candidate {
  applicationId: string;
  candidateId: string;
  name: string;
  email: string;
  phone?: string;
  jobId: string;
  jobTitle: string;
  stage: string;
  stageOrder: number;
  aiScore?: number;
  daysInStage: number;
  appliedAt: string;
  hasInterview?: boolean;
  interviewDate?: string;
}

interface Job {
  id: string;
  title: string;
  location?: string;
  applicationCount: number;
  newThisWeek: number;
}

interface FranchiseData {
  marketName: string;
  jobs: Job[];
  candidates: Candidate[];
  stats: {
    totalApplications: number;
    newThisWeek: number;
    scheduledInterviews: number;
    pendingReview: number;
  };
}

function getScoreBadge(score?: number) {
  if (!score) return null;
  if (score >= 80) {
    return <Badge variant="success" size="sm">{score}/100</Badge>;
  } else if (score >= 60) {
    return <Badge variant="warning" size="sm">{score}/100</Badge>;
  }
  return <Badge variant="neutral" size="sm">{score}/100</Badge>;
}

function getStageBadge(stage: string) {
  const stageColors: Record<string, string> = {
    'Application Review': 'bg-purple-100 text-purple-700',
    'Phone Screen': 'bg-cyan-100 text-cyan-700',
    'Interview': 'bg-cyan-100 text-cyan-700',
    'Teaching Audition': 'bg-yellow-100 text-yellow-700',
    'Offer': 'bg-success-100 text-success-700',
  };
  const colorClass = stageColors[stage] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {stage}
    </span>
  );
}

export default function FranchiseDashboard() {
  const [data, setData] = useState<FranchiseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | 'all'>('all');
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/franchise/dashboard');
      if (res.ok) {
        const franchiseData = await res.json();
        setData(franchiseData);
      }
    } catch (err) {
      console.error('Failed to fetch franchise data:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredCandidates = data?.candidates.filter(
    (c) => selectedJob === 'all' || c.jobId === selectedJob
  ) || [];

  const pendingReview = filteredCandidates.filter((c) => c.stageOrder === 0);
  const inProgress = filteredCandidates.filter((c) => c.stageOrder > 0 && c.stageOrder < 4);
  const readyToHire = filteredCandidates.filter((c) => c.stageOrder >= 4);

  function toggleCandidate(applicationId: string) {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(applicationId)) {
        next.delete(applicationId);
      } else {
        next.add(applicationId);
      }
      return next;
    });
  }

  function getSelectedRecipients() {
    return filteredCandidates
      .filter((c) => selectedCandidates.has(c.applicationId))
      .map((c) => ({
        id: c.applicationId,
        name: c.name,
        email: c.email,
        jobTitle: c.jobTitle,
      }));
  }

  async function handleBulkEmail(emailData: { subject: string; body: string; recipientIds: string[]; fromAddress?: string; cc?: string[]; attachments?: Array<{ name: string; type: string; size: number; content: string }> }) {
    try {
      const res = await fetch('/api/email/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationIds: emailData.recipientIds,
          subject: emailData.subject,
          body: emailData.body,
          fromAddress: emailData.fromAddress,
          cc: emailData.cc,
          attachments: emailData.attachments,
        }),
      });

      if (!res.ok) throw new Error('Failed to send emails');

      setSelectedCandidates(new Set());
      setShowEmailModal(false);
    } catch (err) {
      console.error('Bulk email failed:', err);
      throw err;
    }
  }

  async function handleQuickAction(applicationId: string, action: 'advance' | 'reject' | 'schedule') {
    setActionLoading(true);
    try {
      if (action === 'reject') {
        await fetch(`/api/applications/${applicationId}/reject`, { method: 'POST' });
      } else if (action === 'advance') {
        await fetch(`/api/applications/${applicationId}/advance`, { method: 'POST' });
      } else if (action === 'schedule') {
        // Navigate to scheduling
        window.location.href = `/applications/${applicationId}?action=schedule`;
        return;
      }
      fetchData();
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="h-20 bg-slate-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-slate-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto text-center py-12">
        <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-600">Failed to load dashboard. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900">
          {data.marketName} Hiring Dashboard
        </h1>
        <p className="text-slate-600 mt-1">
          Manage your candidates and hiring pipeline in one place.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Candidates</p>
                <p className="text-2xl font-bold text-navy-900">{data.stats.totalApplications}</p>
              </div>
              <UsersIcon className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">New This Week</p>
                <p className="text-2xl font-bold text-navy-900">{data.stats.newThisWeek}</p>
              </div>
              <SparklesIcon className="h-8 w-8 text-success-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Interviews Scheduled</p>
                <p className="text-2xl font-bold text-navy-900">{data.stats.scheduledInterviews}</p>
              </div>
              <CalendarIcon className="h-8 w-8 text-cyan-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Needs Review</p>
                <p className="text-2xl font-bold text-navy-900">{data.stats.pendingReview}</p>
              </div>
              <ClockIcon className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Job Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={selectedJob === 'all' ? 'primary' : 'outline'}
          onClick={() => setSelectedJob('all')}
        >
          All Jobs ({data.candidates.length})
        </Button>
        {data.jobs.map((job) => (
          <Button
            key={job.id}
            size="sm"
            variant={selectedJob === job.id ? 'primary' : 'outline'}
            onClick={() => setSelectedJob(job.id)}
          >
            {job.title} ({job.applicationCount})
          </Button>
        ))}
      </div>

      {/* Bulk Action Bar */}
      {selectedCandidates.size > 0 && (
        <div className="sticky top-0 z-10 bg-purple-600 text-white rounded-lg p-4 flex items-center justify-between shadow-lg">
          <span className="font-medium">
            {selectedCandidates.size} candidate{selectedCandidates.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="bg-white text-purple-600 border-white hover:bg-purple-50"
              onClick={() => setShowEmailModal(true)}
            >
              <EnvelopeIcon className="w-4 h-4 mr-1" />
              Email All
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-purple-500"
              onClick={() => setSelectedCandidates(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Candidate Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Needs Review */}
        <Card className="border-t-4 border-t-yellow-400">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-yellow-500" />
                Needs Review
              </div>
            }
            action={<Badge variant="warning">{pendingReview.length}</Badge>}
          />
          <CardContent noPadding className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {pendingReview.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <CheckCircleIcon className="h-8 w-8 mx-auto text-success-400 mb-2" />
                <p className="text-sm">All caught up!</p>
              </div>
            ) : (
              pendingReview.map((candidate) => (
                <CandidateRow
                  key={candidate.applicationId}
                  candidate={candidate}
                  isSelected={selectedCandidates.has(candidate.applicationId)}
                  onToggle={() => toggleCandidate(candidate.applicationId)}
                  onAction={handleQuickAction}
                  actionLoading={actionLoading}
                  showActions={['advance', 'reject', 'schedule']}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* In Progress */}
        <Card className="border-t-4 border-t-blue-400">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-cyan-500" />
                In Progress
              </div>
            }
            action={<Badge variant="info">{inProgress.length}</Badge>}
          />
          <CardContent noPadding className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {inProgress.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <p className="text-sm">No candidates in progress</p>
              </div>
            ) : (
              inProgress.map((candidate) => (
                <CandidateRow
                  key={candidate.applicationId}
                  candidate={candidate}
                  isSelected={selectedCandidates.has(candidate.applicationId)}
                  onToggle={() => toggleCandidate(candidate.applicationId)}
                  onAction={handleQuickAction}
                  actionLoading={actionLoading}
                  showActions={['advance', 'reject']}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Ready to Hire */}
        <Card className="border-t-4 border-t-green-400">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <StarIcon className="w-5 h-5 text-success-500" />
                Ready to Hire
              </div>
            }
            action={<Badge variant="success">{readyToHire.length}</Badge>}
          />
          <CardContent noPadding className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {readyToHire.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <p className="text-sm">No candidates ready yet</p>
              </div>
            ) : (
              readyToHire.map((candidate) => (
                <CandidateRow
                  key={candidate.applicationId}
                  candidate={candidate}
                  isSelected={selectedCandidates.has(candidate.applicationId)}
                  onToggle={() => toggleCandidate(candidate.applicationId)}
                  onAction={handleQuickAction}
                  actionLoading={actionLoading}
                  showActions={['advance']}
                  advanceLabel="Make Offer"
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Help Section */}
      <Card className="bg-slate-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <BriefcaseIcon className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold text-navy-900">Need more candidates?</h3>
              <p className="text-sm text-slate-600 mt-1">
                Your job postings are live on Indeed and your career page. Share the direct application link to get more applicants.
              </p>
              <div className="mt-3 flex gap-3">
                <Link href="/jobs">
                  <Button size="sm" variant="outline">
                    View My Jobs
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Email Modal */}
      <BulkEmailModal
        open={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        recipients={getSelectedRecipients()}
        onSend={handleBulkEmail}
      />
    </div>
  );
}

function CandidateRow({
  candidate,
  isSelected,
  onToggle,
  onAction,
  actionLoading,
  showActions,
  advanceLabel = 'Advance',
}: {
  candidate: Candidate;
  isSelected: boolean;
  onToggle: () => void;
  onAction: (id: string, action: 'advance' | 'reject' | 'schedule') => void;
  actionLoading: boolean;
  showActions: Array<'advance' | 'reject' | 'schedule'>;
  advanceLabel?: string;
}) {
  return (
    <div className={`p-4 hover:bg-slate-50 transition-colors ${isSelected ? 'bg-purple-50' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div
          onClick={onToggle}
          className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
            isSelected
              ? 'bg-purple-600 border-purple-600'
              : 'border-slate-300 hover:border-purple-400'
          }`}
        >
          {isSelected && <CheckCircleIcon className="w-3 h-3 text-white" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/applications/${candidate.applicationId}`}
              className="font-medium text-navy-900 hover:text-purple-700 truncate"
            >
              {candidate.name}
            </Link>
            {getScoreBadge(candidate.aiScore)}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            {getStageBadge(candidate.stage)}
            <span className="text-slate-400">•</span>
            <span>{candidate.daysInStage}d in stage</span>
          </div>
          {candidate.phone && (
            <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
              <PhoneIcon className="w-3.5 h-3.5" />
              {candidate.phone}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          {showActions.includes('schedule') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction(candidate.applicationId, 'schedule')}
              disabled={actionLoading}
              title="Schedule interview"
            >
              <CalendarIcon className="w-4 h-4" />
            </Button>
          )}
          {showActions.includes('advance') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction(candidate.applicationId, 'advance')}
              disabled={actionLoading}
              className="text-success-600 hover:bg-success-50"
              title={advanceLabel}
            >
              <ChevronRightIcon className="w-4 h-4" />
            </Button>
          )}
          {showActions.includes('reject') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction(candidate.applicationId, 'reject')}
              disabled={actionLoading}
              className="text-danger-600 hover:bg-danger-50"
              title="Reject"
            >
              <XMarkIcon className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
