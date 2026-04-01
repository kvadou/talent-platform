'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ClipboardDocumentListIcon,
  StarIcon,
} from '@heroicons/react/24/outline';

type Criterion = {
  id: string;
  name: string;
  weight: number;
  scoringType: 'RATING' | 'YES_NO' | 'TEXT';
  required: boolean;
  options?: string[];
};

type Scorecard = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  criteria: Criterion[];
  isDefault: boolean;
  jobId: string | null;
  organizationId: string;
};

const INTERVIEW_TYPES = [
  { value: 'PHONE_SCREEN', label: 'Phone Screen' },
  { value: 'VIDEO', label: 'Video Interview' },
  { value: 'ONSITE', label: 'Onsite' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'PANEL', label: 'Panel' },
  { value: 'OTHER', label: 'Other' },
];

export default function ScorecardPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [orgScorecards, setOrgScorecards] = useState<Scorecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingScorecard, setEditingScorecard] = useState<Scorecard | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchScorecards = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/scorecards`);
      if (res.ok) {
        const data = await res.json();
        setScorecards(data.jobScorecards || []);
        setOrgScorecards(data.orgScorecards || []);
      }
    } catch (err) {
      console.error('Failed to load scorecards', err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchScorecards();
  }, [fetchScorecards]);

  async function applyOrgScorecard(orgScorecard: Scorecard) {
    try {
      const res = await fetch(`/api/jobs/${jobId}/scorecards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgScorecard.name,
          description: orgScorecard.description,
          type: orgScorecard.type,
          criteria: orgScorecard.criteria,
        }),
      });

      if (res.ok) {
        await fetchScorecards();
      }
    } catch (err) {
      console.error('Failed to copy scorecard', err);
    }
  }

  function deleteScorecard(id: string) {
    setConfirmDeleteId(id);
  }

  async function confirmDeleteScorecard() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);

    try {
      const res = await fetch(`/api/jobs/${jobId}/scorecards/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchScorecards();
      }
    } catch (err) {
      console.error('Failed to delete scorecard', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Scorecards</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure interview scorecards for consistent candidate evaluation.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Create Scorecard
        </Button>
      </div>

      {/* Job-specific Scorecards */}
      <Card>
        <CardHeader title="Job Scorecards" />
        <CardContent>
          {scorecards.length > 0 ? (
            <div className="space-y-3">
              {scorecards.map((scorecard) => (
                <div
                  key={scorecard.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                >
                  <div className="p-2 bg-brand-purple/10 rounded-lg">
                    <ClipboardDocumentListIcon className="w-5 h-5 text-brand-purple" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{scorecard.name}</h4>
                      <Badge variant="neutral">
                        {INTERVIEW_TYPES.find((t) => t.value === scorecard.type)?.label ||
                          scorecard.type}
                      </Badge>
                    </div>
                    {scorecard.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{scorecard.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>{scorecard.criteria.length} criteria</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <StarIcon className="w-3.5 h-3.5" />
                        {scorecard.criteria.filter((c) => c.scoringType === 'RATING').length} rated
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingScorecard(scorecard);
                        setShowModal(true);
                      }}
                      className="p-2 text-gray-400 hover:text-brand-purple rounded-lg hover:bg-white transition-colors"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteScorecard(scorecard.id)}
                      className="p-2 text-gray-400 hover:text-danger-600 rounded-lg hover:bg-white transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ClipboardDocumentListIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No scorecards configured for this job.</p>
              <p className="text-sm text-gray-400">
                Create a new scorecard or use one from your organization templates below.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Organization Templates */}
      {orgScorecards.length > 0 && (
        <Card>
          <CardHeader title="Organization Templates" />
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Use existing templates from your organization as a starting point.
            </p>
            <div className="space-y-2">
              {orgScorecards.map((scorecard) => (
                <div
                  key={scorecard.id}
                  className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg hover:border-brand-purple transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{scorecard.name}</span>
                      <Badge variant="neutral">
                        {INTERVIEW_TYPES.find((t) => t.value === scorecard.type)?.label ||
                          scorecard.type}
                      </Badge>
                      {scorecard.isDefault && (
                        <Badge variant="success">Default</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{scorecard.criteria.length} criteria</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyOrgScorecard(scorecard)}
                  >
                    Use Template
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDeleteScorecard}
        title="Delete Scorecard"
        message="Delete this scorecard?"
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Scorecard Modal */}
      {showModal && (
        <ScorecardModal
          jobId={jobId}
          scorecard={editingScorecard}
          onClose={() => {
            setShowModal(false);
            setEditingScorecard(null);
          }}
          onSave={() => {
            setShowModal(false);
            setEditingScorecard(null);
            fetchScorecards();
          }}
        />
      )}
    </div>
  );
}

function ScorecardModal({
  jobId,
  scorecard,
  onClose,
  onSave,
}: {
  jobId: string;
  scorecard: Scorecard | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(scorecard?.name || '');
  const [description, setDescription] = useState(scorecard?.description || '');
  const [type, setType] = useState(scorecard?.type || 'PHONE_SCREEN');
  const [criteria, setCriteria] = useState<Criterion[]>(
    scorecard?.criteria || [
      { id: crypto.randomUUID(), name: '', weight: 1, scoringType: 'RATING', required: true },
    ]
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const url = scorecard
        ? `/api/jobs/${jobId}/scorecards/${scorecard.id}`
        : `/api/jobs/${jobId}/scorecards`;

      const res = await fetch(url, {
        method: scorecard ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, type, criteria }),
      });

      if (res.ok) {
        onSave();
      }
    } catch (err) {
      console.error('Failed to save scorecard', err);
    } finally {
      setSaving(false);
    }
  }

  function addCriterion() {
    setCriteria([
      ...criteria,
      { id: crypto.randomUUID(), name: '', weight: 1, scoringType: 'RATING', required: true },
    ]);
  }

  function updateCriterion(id: string, updates: Partial<Criterion>) {
    setCriteria(criteria.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }

  function removeCriterion(id: string) {
    if (criteria.length <= 1) return;
    setCriteria(criteria.filter((c) => c.id !== id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {scorecard ? 'Edit Scorecard' : 'Create Scorecard'}
            </h3>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g., Technical Screen"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interview Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                >
                  {INTERVIEW_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief description of this scorecard..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Criteria</label>
                <button
                  type="button"
                  onClick={addCriterion}
                  className="text-sm text-brand-purple hover:underline"
                >
                  + Add Criterion
                </button>
              </div>

              <div className="space-y-3">
                {criteria.map((criterion, index) => (
                  <div key={criterion.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <span className="text-sm text-gray-400 pt-2">{index + 1}.</span>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={criterion.name}
                          onChange={(e) =>
                            updateCriterion(criterion.id, { name: e.target.value })
                          }
                          placeholder="Criterion name..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                        />
                        <div className="flex items-center gap-3">
                          <select
                            value={criterion.scoringType}
                            onChange={(e) =>
                              updateCriterion(criterion.id, {
                                scoringType: e.target.value as Criterion['scoringType'],
                              })
                            }
                            className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                          >
                            <option value="RATING">1-5 Rating</option>
                            <option value="YES_NO">Yes/No</option>
                            <option value="TEXT">Text</option>
                          </select>
                          <label className="flex items-center gap-1.5 text-sm">
                            <input
                              type="checkbox"
                              checked={criterion.required}
                              onChange={(e) =>
                                updateCriterion(criterion.id, { required: e.target.checked })
                              }
                              className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
                            />
                            Required
                          </label>
                        </div>
                      </div>
                      {criteria.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCriterion(criterion.id)}
                          className="p-1 text-gray-400 hover:text-danger-600"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : scorecard ? 'Update Scorecard' : 'Create Scorecard'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
