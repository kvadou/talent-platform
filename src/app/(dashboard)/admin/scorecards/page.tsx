'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ClipboardDocumentCheckIcon,
  StarIcon,
  CheckIcon,
  ChatBubbleLeftIcon,
} from '@heroicons/react/24/outline';

type ScoringType = 'SCALE' | 'BOOLEAN' | 'TEXT';

type Criterion = {
  id: string;
  name: string;
  description?: string;
  scoringType: ScoringType;
  weight?: number;
};

type Scorecard = {
  id: string;
  name: string;
  description?: string;
  type: string;
  criteria: Criterion[];
  jobId?: string;
  job?: { id: string; title: string };
  isDefault: boolean;
  _count?: { interviews: number };
};

const INTERVIEW_TYPES = [
  'PHONE_SCREEN',
  'VIDEO_INTERVIEW',
  'ONSITE_INTERVIEW',
  'TECHNICAL_INTERVIEW',
  'CULTURE_FIT',
  'FINAL_INTERVIEW',
];

const SCORING_TYPES: { value: ScoringType; label: string; icon: React.ReactNode }[] = [
  { value: 'SCALE', label: '1-5 Scale', icon: <StarIcon className="h-4 w-4" /> },
  { value: 'BOOLEAN', label: 'Yes/No', icon: <CheckIcon className="h-4 w-4" /> },
  { value: 'TEXT', label: 'Text', icon: <ChatBubbleLeftIcon className="h-4 w-4" /> },
];

export default function ScorecardsPage() {
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingScorecard, setEditingScorecard] = useState<Scorecard | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchScorecards();
  }, []);

  async function fetchScorecards() {
    try {
      const res = await fetch('/api/interview-scorecards');
      if (res.ok) {
        const data = await res.json();
        setScorecards(data.scorecards);
      }
    } catch (err) {
      console.error('Failed to fetch scorecards:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(scorecard: Scorecard) {
    setEditingScorecard(scorecard);
    setShowForm(true);
  }

  function handleDelete(id: string) {
    setConfirmDeleteId(id);
  }

  async function confirmDeleteScorecard() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);

    try {
      const res = await fetch(`/api/interview-scorecards?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setScorecards(scorecards.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete scorecard:', err);
    }
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingScorecard(null);
  }

  function handleFormSaved() {
    fetchScorecards();
    handleFormClose();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading scorecards...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interview Scorecards</h1>
          <p className="text-gray-600 mt-1">
            Create and manage evaluation criteria for different interview types
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          New Scorecard
        </Button>
      </div>

      {/* Scorecards Grid */}
      {scorecards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardDocumentCheckIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No scorecards yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first scorecard to standardize interview evaluations
            </p>
            <Button onClick={() => setShowForm(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Scorecard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scorecards.map((scorecard) => (
            <Card key={scorecard.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{scorecard.name}</h3>
                    <Badge variant="purple" size="sm" className="mt-1">
                      {scorecard.type.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(scorecard)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(scorecard.id)}
                      className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {scorecard.description && (
                  <p className="text-sm text-gray-500 mb-3">{scorecard.description}</p>
                )}

                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Criteria ({scorecard.criteria.length})
                  </div>
                  <div className="space-y-1">
                    {scorecard.criteria.slice(0, 4).map((criterion) => (
                      <div
                        key={criterion.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-gray-700">{criterion.name}</span>
                        <Badge variant="neutral" size="sm">
                          {SCORING_TYPES.find((t) => t.value === criterion.scoringType)?.label}
                        </Badge>
                      </div>
                    ))}
                    {scorecard.criteria.length > 4 && (
                      <div className="text-xs text-gray-400">
                        +{scorecard.criteria.length - 4} more
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {scorecard._count?.interviews || 0} interviews using this
                  </span>
                  {scorecard.isDefault && (
                    <Badge variant="info" size="sm">Default</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDeleteScorecard}
        title="Delete Scorecard"
        message="Are you sure you want to delete this scorecard?"
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Form Modal */}
      {showForm && (
        <ScorecardForm
          scorecard={editingScorecard}
          onClose={handleFormClose}
          onSaved={handleFormSaved}
        />
      )}
    </div>
  );
}

// Scorecard Form Component
function ScorecardForm({
  scorecard,
  onClose,
  onSaved,
}: {
  scorecard: Scorecard | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(scorecard?.name || '');
  const [description, setDescription] = useState(scorecard?.description || '');
  const [type, setType] = useState(scorecard?.type || 'VIDEO_INTERVIEW');
  const [isDefault, setIsDefault] = useState(scorecard?.isDefault || false);
  const [criteria, setCriteria] = useState<Criterion[]>(
    scorecard?.criteria || [
      { id: crypto.randomUUID(), name: '', scoringType: 'SCALE' },
    ]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addCriterion() {
    setCriteria([
      ...criteria,
      { id: crypto.randomUUID(), name: '', scoringType: 'SCALE' },
    ]);
  }

  function updateCriterion(id: string, updates: Partial<Criterion>) {
    setCriteria(criteria.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }

  function removeCriterion(id: string) {
    if (criteria.length <= 1) return;
    setCriteria(criteria.filter((c) => c.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Validate
    if (!name.trim()) {
      setError('Name is required');
      setSaving(false);
      return;
    }

    const validCriteria = criteria.filter((c) => c.name.trim());
    if (validCriteria.length === 0) {
      setError('At least one criterion is required');
      setSaving(false);
      return;
    }

    const payload = {
      ...(scorecard ? { id: scorecard.id } : {}),
      name: name.trim(),
      description: description.trim() || null,
      type,
      isDefault,
      criteria: validCriteria.map((c) => ({
        id: c.id,
        name: c.name.trim(),
        description: c.description?.trim() || undefined,
        scoringType: c.scoringType,
        weight: c.weight,
      })),
    };

    try {
      const res = await fetch('/api/interview-scorecards', {
        method: scorecard ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save scorecard');
      }

      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {scorecard ? 'Edit Scorecard' : 'New Scorecard'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="e.g., Technical Interview Scorecard"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Interview Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {INTERVIEW_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Set as default for this type</span>
              </label>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Brief description of when to use this scorecard..."
              />
            </div>
          </div>

          {/* Criteria */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Evaluation Criteria
              </label>
              <Button type="button" size="sm" variant="secondary" onClick={addCriterion}>
                <PlusIcon className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            <div className="space-y-3">
              {criteria.map((criterion, index) => (
                <div
                  key={criterion.id}
                  className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={criterion.name}
                      onChange={(e) =>
                        updateCriterion(criterion.id, { name: e.target.value })
                      }
                      placeholder="Criterion name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <div className="flex gap-2">
                      {SCORING_TYPES.map((st) => (
                        <button
                          key={st.value}
                          type="button"
                          onClick={() =>
                            updateCriterion(criterion.id, { scoringType: st.value })
                          }
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            criterion.scoringType === st.value
                              ? 'bg-purple-100 text-purple-800 border border-purple-300'
                              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {st.icon}
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {criteria.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCriterion(criterion.id)}
                      className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : scorecard ? 'Update Scorecard' : 'Create Scorecard'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
