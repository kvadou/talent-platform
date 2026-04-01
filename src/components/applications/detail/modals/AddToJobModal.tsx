'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface Job {
  id: string;
  title: string;
  status: string;
  market: { id: string; name: string };
  stages: Array<{ id: string; name: string; order: number }>;
}

interface AddToJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: string;
  candidateName: string;
  currentJobId: string;
  existingJobIds: string[]; // Jobs candidate already has applications for
  onSuccess: () => void;
}

export function AddToJobModal({
  isOpen,
  onClose,
  candidateId,
  candidateName,
  currentJobId,
  existingJobIds,
  onSuccess,
}: AddToJobModalProps) {
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
          // Filter out jobs the candidate already applied to
          const availableJobs = data.jobs.filter(
            (job: Job) => !existingJobIds.includes(job.id)
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
  }, [isOpen, existingJobIds]);

  // Filter jobs by search
  const filteredJobs = jobs.filter((job) => {
    const searchLower = search.toLowerCase();
    return (
      job.title.toLowerCase().includes(searchLower) ||
      job.market.name.toLowerCase().includes(searchLower)
    );
  });

  const handleAdd = async () => {
    if (!selectedJobId) return;

    setSubmitting(true);
    setError('');

    try {
      const selectedJob = jobs.find((j) => j.id === selectedJobId);
      const firstStage = selectedJob?.stages?.[0];

      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          jobId: selectedJobId,
          stageId: firstStage?.id,
          source: 'Added from existing application',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add candidate to job');
      }

      const newApplication = await res.json();
      onSuccess();
      onClose();
      // Navigate to the new application
      router.push(`/applications/${newApplication.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add candidate to job');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Add to Another Job"
      className="max-w-lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Add <span className="font-medium text-gray-900">{candidateName}</span> to another job.
          This will create a new application while keeping the current one.
        </p>

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
        <Button onClick={handleAdd} loading={submitting} disabled={!selectedJobId}>
          Add to Job
        </Button>
      </div>
    </Modal>
  );
}
