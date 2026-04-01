'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { XMarkIcon, PlusIcon, MinusIcon } from '@heroicons/react/24/outline';

type Props = {
  candidateIds: string[];
  onClose: () => void;
  onSuccess: () => void;
};

export function BulkTagModal({ candidateIds, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [tag, setTag] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!tag.trim()) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/candidates/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode === 'add' ? 'add_tag' : 'remove_tag',
          candidateIds,
          tag: tag.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update tags');
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
          <h2 className="text-lg font-bold text-gray-900">Manage Tags</h2>
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
            {mode === 'add' ? 'Add' : 'Remove'} a tag {mode === 'add' ? 'to' : 'from'}{' '}
            {candidateIds.length} candidate{candidateIds.length !== 1 ? 's' : ''}.
          </p>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('add')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'add'
                  ? 'bg-success-100 text-success-800 border-2 border-success-400'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              <PlusIcon className="h-4 w-4" />
              Add Tag
            </button>
            <button
              onClick={() => setMode('remove')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'remove'
                  ? 'bg-danger-100 text-danger-800 border-2 border-danger-400'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              <MinusIcon className="h-4 w-4" />
              Remove Tag
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Tag Name</label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="e.g., priority, follow-up, experienced"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!tag.trim() || submitting}
            variant={mode === 'add' ? 'primary' : 'danger'}
          >
            {submitting ? 'Processing...' : mode === 'add' ? 'Add Tag' : 'Remove Tag'}
          </Button>
        </div>
      </div>
    </div>
  );
}
