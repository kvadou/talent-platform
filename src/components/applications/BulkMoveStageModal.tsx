'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { XMarkIcon } from '@heroicons/react/24/outline';

type Stage = {
  id: string;
  name: string;
  order: number;
};

type Props = {
  applicationIds: string[];
  onClose: () => void;
  onSuccess: () => void;
};

export function BulkMoveStageModal({ applicationIds, onClose, onSuccess }: Props) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch available stages - use first application's job stages
    async function fetchStages() {
      try {
        const res = await fetch(`/api/applications/${applicationIds[0]}`);
        if (res.ok) {
          const data = await res.json();
          const jobId = data.application?.jobId;
          if (jobId) {
            const stagesRes = await fetch(`/api/jobs/${jobId}/stages`);
            if (stagesRes.ok) {
              const stagesData = await stagesRes.json();
              setStages(stagesData.stages || []);
            }
          }
        }
      } catch (err) {
        setError('Failed to load stages');
      } finally {
        setLoading(false);
      }
    }
    fetchStages();
  }, [applicationIds]);

  async function handleSubmit() {
    if (!selectedStageId) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/applications/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move_stage',
          applicationIds,
          stageId: selectedStageId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to move applications');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Move to Stage</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
              {error}
            </div>
          )}

          <p className="text-sm text-gray-600">
            Move {applicationIds.length} application{applicationIds.length !== 1 ? 's' : ''} to a new stage.
          </p>

          {loading ? (
            <div className="text-sm text-gray-500">Loading stages...</div>
          ) : (
            <div className="space-y-2">
              {stages
                .sort((a, b) => a.order - b.order)
                .map((stage) => (
                  <label
                    key={stage.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedStageId === stage.id
                        ? 'border-purple-400 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="stage"
                      value={stage.id}
                      checked={selectedStageId === stage.id}
                      onChange={() => setSelectedStageId(stage.id)}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span className="font-medium text-gray-900">{stage.name}</span>
                  </label>
                ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedStageId || submitting}>
            {submitting ? 'Moving...' : 'Move Applications'}
          </Button>
        </div>
      </div>
    </div>
  );
}
