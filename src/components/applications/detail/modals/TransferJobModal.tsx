'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MagnifyingGlassIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Job {
  id: string;
  title: string;
  status: string;
  market: { id: string; name: string };
  stages: Array<{ id: string; name: string; order: number }>;
}

interface TransferJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  candidateName: string;
  currentJobId: string;
  currentJobTitle: string;
  onSuccess: () => void;
}

export function TransferJobModal({
  isOpen,
  onClose,
  applicationId,
  candidateName,
  currentJobId,
  currentJobTitle,
  onSuccess,
}: TransferJobModalProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Fetch available jobs
  useEffect(() => {
    if (!isOpen) return;

    async function fetchJobs() {
      setLoading(true);
      try {
        const res = await fetch('/api/jobs?status=OPEN&limit=100');
        if (res.ok) {
          const data = await res.json();
          // Filter out current job
          const availableJobs = data.jobs.filter(
            (job: Job) => job.id !== currentJobId
          );
          setJobs(availableJobs);
        }
      } catch (e) {
        console.error('Failed to fetch jobs:', e);
      } finally {
        setLoading(false);
      }
    }

    fetchJobs();
  }, [isOpen, currentJobId]);

  // Filter jobs by search
  const filteredJobs = jobs.filter((job) => {
    const searchLower = search.toLowerCase();
    return (
      job.title.toLowerCase().includes(searchLower) ||
      job.market.name.toLowerCase().includes(searchLower)
    );
  });

  const handleTransfer = async () => {
    if (!selectedJobId) return;

    setSubmitting(true);
    setError('');

    try {
      const selectedJob = jobs.find((j) => j.id === selectedJobId);
      const firstStage = selectedJob?.stages?.[0];

      const res = await fetch(`/api/applications/${applicationId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetJobId: selectedJobId,
          targetStageId: firstStage?.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to transfer candidate');
      }

      onSuccess();
      onClose();
      // Refresh the page to show updated job info
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to transfer candidate');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Transfer to Different Job"
      className="max-w-lg"
    >
      <div className="space-y-4">
        {/* Warning */}
        <div className="p-3 bg-warning-50 border border-warning-200 rounded-lg flex gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-warning-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-warning-800 font-medium">This will replace the current application</p>
            <p className="text-sm text-warning-700 mt-1">
              <span className="font-medium">{candidateName}</span> will be moved from{' '}
              <span className="font-medium">{currentJobTitle}</span> to the selected job.
              Interview history and notes will be preserved.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-danger-50 text-danger-700 text-sm rounded-lg border border-danger-200">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Jobs list */}
        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading jobs...</div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {jobs.length === 0
                ? 'No other jobs available'
                : 'No jobs match your search'}
            </div>
          ) : (
            filteredJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => setSelectedJobId(job.id)}
                className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                  selectedJobId === job.id ? 'bg-purple-50 border-l-2 border-purple-500' : ''
                }`}
              >
                <div className="font-medium text-gray-900">{job.title}</div>
                <div className="text-sm text-gray-500">{job.market.name}</div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleTransfer}
          loading={submitting}
          disabled={!selectedJobId}
          className="bg-warning-600 hover:bg-warning-700"
        >
          Transfer Candidate
        </Button>
      </div>
    </Modal>
  );
}
