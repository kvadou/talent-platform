'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  PlusCircleIcon,
  ArrowsRightLeftIcon,
  EllipsisHorizontalIcon,
  TrashIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { AlertModal } from '@/components/ui/AlertModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { MoveStageModal } from './modals/MoveStageModal';
import { RejectModal } from './modals/RejectModal';
import { AddToJobModal } from './modals/AddToJobModal';
import { TransferJobModal } from './modals/TransferJobModal';
import { BulkEmailModal } from '@/components/email/BulkEmailModal';
import type { ApplicationData } from './ApplicationDetailPage';

type Props = {
  application: ApplicationData;
  totalCandidates: number;
  currentIndex: number;
  prevApplicationId: string | null;
  nextApplicationId: string | null;
  onRefresh: () => void;
};

export function ApplicationHeader({
  application,
  totalCandidates,
  currentIndex,
  prevApplicationId,
  nextApplicationId,
  onRefresh,
}: Props) {
  const router = useRouter();
  const [isMoveStageModalOpen, setIsMoveStageModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isAddToJobModalOpen, setIsAddToJobModalOpen] = useState(false);
  const [isTransferJobModalOpen, setIsTransferJobModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const candidateName = `${application.candidate.firstName} ${application.candidate.lastName}`;

  // Close more menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get list of job IDs candidate already has applications for
  const existingJobIds = application.candidate.applications.map((app) => app.job.id);

  const handleViewResume = async () => {
    if (!application.candidate.resumeUrl) {
      setAlertMsg('No resume on file for this candidate');
      return;
    }
    try {
      const res = await fetch(`/api/candidates/${application.candidate.id}/resume`);
      if (!res.ok) {
        const data = await res.json();
        setAlertMsg(data.error || 'Failed to get resume');
        return;
      }
      const { url } = await res.json();
      window.open(url, '_blank');
    } catch (e) {
      console.error('Failed to get resume:', e);
      setAlertMsg('Failed to get resume');
    }
  };

  const handleSendEmail = async (data: { subject: string; body: string; recipientIds: string[]; fromAddress?: string; cc?: string[]; attachments?: Array<{ name: string; type: string; size: number; content: string }> }) => {
    const res = await fetch('/api/emails/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: data.subject,
        body: data.body,
        candidateIds: [application.candidate.id],
        applicationIds: [application.id],
        fromAddress: data.fromAddress,
        cc: data.cc,
        attachments: data.attachments,
      }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to send email');
    }
    onRefresh();
  };

  const handleDeleteApplication = async () => {
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete application');
      }
      // Navigate back to the pipeline
      router.push(`/jobs/${application.job.id}/pipeline`);
    } catch (e) {
      setAlertMsg(e instanceof Error ? e.message : 'Failed to delete application');
    } finally {
      setIsDeleting(false);
      setIsMoreMenuOpen(false);
    }
  };

  const handleExportCandidate = () => {
    // Export candidate data as JSON
    const exportData = {
      candidate: {
        name: candidateName,
        email: application.candidate.email,
        phone: application.candidate.phone,
        linkedin: application.candidate.linkedinUrl,
      },
      application: {
        job: application.job.title,
        market: application.job.market.name,
        stage: application.stage.name,
        status: application.status,
        appliedAt: application.createdAt,
      },
      interviews: application.interviews,
      notes: application.notes,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${candidateName.replace(/\s+/g, '_')}_export.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsMoreMenuOpen(false);
  };

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        {/* Breadcrumb and Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          {/* Breadcrumb */}
          <nav className="flex items-center text-sm text-gray-500 overflow-x-auto no-scrollbar">
            <Link href="/jobs" className="hover:text-brand-purple whitespace-nowrap">
              All jobs
            </Link>
            <ChevronRightIcon className="w-4 h-4 mx-2 flex-shrink-0" />
            <Link
              href={`/jobs/${application.job.id}/pipeline`}
              className="hover:text-brand-purple whitespace-nowrap"
            >
              {application.job.title} ({application.job.market.name})
            </Link>
            <ChevronRightIcon className="w-4 h-4 mx-2 flex-shrink-0" />
            <Link
              href={`/candidates/${application.candidate.id}`}
              className="text-gray-900 font-medium whitespace-nowrap hover:text-brand-purple"
            >
              {candidateName}
            </Link>
          </nav>

          {/* Candidate Navigation */}
          {totalCandidates > 1 && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <button
                onClick={() => prevApplicationId && router.push(`/applications/${prevApplicationId}`)}
                disabled={!prevApplicationId}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <span className="whitespace-nowrap">
                Candidate {currentIndex} of {totalCandidates}
              </span>
              <button
                onClick={() => nextApplicationId && router.push(`/applications/${nextApplicationId}`)}
                disabled={!nextApplicationId}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Candidate Info and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Candidate Name and Contact */}
          <div>
            <h1 className="text-2xl lg:text-3xl font-semibold text-gray-900">{candidateName}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
              <a href={`mailto:${application.candidate.email}`} className="text-brand-purple hover:underline">
                {application.candidate.email}
              </a>
              {application.candidate.phone && (
                <>
                  <span className="text-gray-300">|</span>
                  <a href={`tel:${application.candidate.phone}`} className="text-brand-purple hover:underline">
                    {application.candidate.phone}
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Icon buttons */}
            <div className="hidden sm:flex items-center gap-1">
              <button
                onClick={handleViewResume}
                className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${
                  application.candidate.resumeUrl
                    ? 'text-gray-500 hover:text-gray-700'
                    : 'text-gray-300 cursor-not-allowed'
                }`}
                title={application.candidate.resumeUrl ? 'View resume' : 'No resume on file'}
                disabled={!application.candidate.resumeUrl}
              >
                <DocumentTextIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsEmailModalOpen(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Send email"
              >
                <EnvelopeIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsAddToJobModalOpen(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Add to another job"
              >
                <PlusCircleIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsTransferJobModalOpen(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Transfer to different job"
              >
                <ArrowsRightLeftIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Primary Actions */}
            <Button
              variant="outline"
              onClick={() => setIsRejectModalOpen(true)}
              className="border-danger-300 text-danger-600 hover:bg-danger-50"
            >
              Reject
            </Button>
            <Button onClick={() => setIsMoveStageModalOpen(true)}>
              Move stage
            </Button>

            {/* More menu */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <EllipsisHorizontalIcon className="w-5 h-5" />
              </button>

              {/* Dropdown menu */}
              {isMoreMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={handleExportCandidate}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    Export candidate
                  </button>
                  <hr className="my-1 border-gray-100" />
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isDeleting}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger-600 hover:bg-danger-50 disabled:opacity-50"
                  >
                    <TrashIcon className="w-4 h-4" />
                    {isDeleting ? 'Deleting...' : 'Delete application'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <MoveStageModal
        isOpen={isMoveStageModalOpen}
        onClose={() => setIsMoveStageModalOpen(false)}
        applicationId={application.id}
        currentStageId={application.stage.id}
        stages={application.job.stages}
        onMoveComplete={() => {
          setIsMoveStageModalOpen(false);
          onRefresh();
        }}
      />

      <RejectModal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        applicationId={application.id}
        candidateName={candidateName}
        onRejectComplete={() => {
          setIsRejectModalOpen(false);
          onRefresh();
        }}
      />

      <BulkEmailModal
        open={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        recipients={[
          {
            id: application.id,
            name: candidateName,
            email: application.candidate.email,
            jobTitle: application.job.title,
          },
        ]}
        onSend={handleSendEmail}
      />

      <AddToJobModal
        isOpen={isAddToJobModalOpen}
        onClose={() => setIsAddToJobModalOpen(false)}
        candidateId={application.candidate.id}
        candidateName={candidateName}
        currentJobId={application.job.id}
        existingJobIds={existingJobIds}
        onSuccess={onRefresh}
      />

      <TransferJobModal
        isOpen={isTransferJobModalOpen}
        onClose={() => setIsTransferJobModalOpen(false)}
        applicationId={application.id}
        candidateName={candidateName}
        currentJobId={application.job.id}
        currentJobTitle={application.job.title}
        onSuccess={onRefresh}
      />

      <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} title="Notice" message={alertMsg || ""} />

      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteApplication}
        title="Delete Application"
        message="Are you sure you want to delete this application? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
