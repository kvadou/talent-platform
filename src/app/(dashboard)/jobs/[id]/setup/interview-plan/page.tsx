'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AlertModal } from '@/components/ui/AlertModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  PlusIcon,
  TrashIcon,
  Bars3Icon,
  ChevronUpIcon,
  ChevronDownIcon,
  BookOpenIcon,
  PhoneIcon,
  VideoCameraIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

const INTERVIEW_TYPE_OPTIONS = [
  { value: '', label: 'No default', icon: null },
  { value: 'PHONE_SCREEN', label: 'Phone Screen', icon: PhoneIcon },
  { value: 'VIDEO_INTERVIEW', label: 'Video Interview', icon: VideoCameraIcon },
  { value: 'ONSITE', label: 'In Person', icon: BuildingOfficeIcon },
] as const;

type InterviewKit = {
  id: string;
  name: string;
  type: string;
  duration: number;
  includesAudition: boolean;
};

type Stage = {
  id: string;
  name: string;
  order: number;
  isDefault: boolean;
  defaultInterviewType: string | null;
  _count?: {
    applications: number;
    stageRules: number;
  };
  interviewKits?: InterviewKit[];
};

export default function InterviewPlanPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchStages = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setStages(data.stages || []);
      }
    } catch (err) {
      console.error('Failed to load stages', err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  async function addStage() {
    if (!newStageName.trim()) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/jobs/${jobId}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStageName.trim() }),
      });

      if (res.ok) {
        setNewStageName('');
        await fetchStages();
      }
    } catch (err) {
      console.error('Failed to add stage', err);
    } finally {
      setSaving(false);
    }
  }

  async function updateStage(stageId: string, name: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/stages/${stageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        setEditingId(null);
        await fetchStages();
      }
    } catch (err) {
      console.error('Failed to update stage', err);
    } finally {
      setSaving(false);
    }
  }

  async function updateStageInterviewType(stageId: string, defaultInterviewType: string) {
    try {
      const res = await fetch(`/api/jobs/${jobId}/stages/${stageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultInterviewType }),
      });

      if (res.ok) {
        setStages((prev) =>
          prev.map((s) => (s.id === stageId ? { ...s, defaultInterviewType: defaultInterviewType || null } : s))
        );
      }
    } catch (err) {
      console.error('Failed to update interview type', err);
    }
  }

  function deleteStage(stageId: string) {
    const stage = stages.find((s) => s.id === stageId);
    if (stage?.isDefault) {
      setAlertMsg('Cannot delete the default stage');
      return;
    }
    if (stage?._count?.applications && stage._count.applications > 0) {
      setAlertMsg('Cannot delete a stage with candidates. Move candidates first.');
      return;
    }

    setConfirmDeleteId(stageId);
  }

  async function confirmDeleteStage() {
    if (!confirmDeleteId) return;
    setConfirmDeleteId(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/stages/${confirmDeleteId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchStages();
      }
    } catch (err) {
      console.error('Failed to delete stage', err);
    } finally {
      setSaving(false);
    }
  }

  async function moveStage(stageId: string, direction: 'up' | 'down') {
    const currentIndex = stages.findIndex((s) => s.id === stageId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= stages.length) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/stages/${stageId}/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOrder: stages[newIndex].order }),
      });

      if (res.ok) {
        await fetchStages();
      }
    } catch (err) {
      console.error('Failed to reorder stage', err);
    } finally {
      setSaving(false);
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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Interview Plan</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure the stages candidates move through during the hiring process.
        </p>
      </div>

      <Card>
        <CardHeader title="Pipeline Stages" />
        <CardContent>
          <div className="space-y-2">
            {stages.map((stage, index) => (
              <div
                key={stage.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group"
              >
                <Bars3Icon className="w-5 h-5 text-gray-400 cursor-grab" />

                {/* Stage name */}
                <div className="flex-1">
                  {editingId === stage.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateStage(stage.id, editName);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => updateStage(stage.id, editName)}
                        disabled={saving}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(stage.id);
                        setEditName(stage.name);
                      }}
                      className="text-left font-medium text-gray-900 hover:text-brand-purple"
                    >
                      {stage.name}
                      {stage.isDefault && (
                        <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </button>
                  )}
                </div>

                {/* Interview Type selector */}
                <select
                  value={stage.defaultInterviewType || ''}
                  onChange={(e) => updateStageInterviewType(stage.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-600 bg-white hover:border-brand-purple focus:ring-1 focus:ring-brand-purple focus:border-brand-purple"
                >
                  {INTERVIEW_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Candidate count */}
                {stage._count?.applications !== undefined && (
                  <span className="text-sm text-gray-500">
                    {stage._count.applications} candidate{stage._count.applications !== 1 ? 's' : ''}
                  </span>
                )}

                {/* Interview Kits indicator */}
                {stage.interviewKits && stage.interviewKits.length > 0 && (
                  <Link
                    href={`/jobs/${jobId}/setup/interview-kits`}
                    className="flex items-center gap-1 text-xs bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded hover:bg-cyan-100 transition-colors"
                  >
                    <BookOpenIcon className="w-3 h-3" />
                    {stage.interviewKits.length} kit{stage.interviewKits.length !== 1 ? 's' : ''}
                  </Link>
                )}

                {/* Rules indicator */}
                {stage._count?.stageRules && stage._count.stageRules > 0 && (
                  <span className="text-xs bg-brand-purple/10 text-brand-purple px-2 py-0.5 rounded">
                    {stage._count.stageRules} rule{stage._count.stageRules !== 1 ? 's' : ''}
                  </span>
                )}

                {/* Move buttons */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => moveStage(stage.id, 'up')}
                    disabled={index === 0 || saving}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ChevronUpIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveStage(stage.id, 'down')}
                    disabled={index === stages.length - 1 || saving}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ChevronDownIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Delete button */}
                {!stage.isDefault && (
                  <button
                    onClick={() => deleteStage(stage.id)}
                    disabled={saving}
                    className="p-1 text-gray-400 hover:text-danger-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {stages.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No stages configured yet.
              </p>
            )}
          </div>

          {/* Add new stage */}
          <div className="mt-4 flex items-center gap-2">
            <input
              type="text"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="New stage name..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addStage();
                }
              }}
            />
            <Button onClick={addStage} disabled={!newStageName.trim() || saving}>
              <PlusIcon className="w-4 h-4 mr-1.5" />
              Add Stage
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} title="Notice" message={alertMsg || ""} />
      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDeleteStage}
        title="Delete Stage"
        message="Are you sure you want to delete this stage?"
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Common stage templates */}
      <Card>
        <CardHeader title="Quick Add" />
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Quickly add common interview stages:
          </p>
          <div className="flex flex-wrap gap-2">
            {['Phone Screen', 'Technical Interview', 'Onsite', 'Team Interview', 'Final Round', 'Reference Check', 'Offer'].map(
              (template) => (
                <button
                  key={template}
                  onClick={() => {
                    setNewStageName(template);
                  }}
                  disabled={stages.some((s) => s.name === template)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:border-brand-purple hover:text-brand-purple disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  + {template}
                </button>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
