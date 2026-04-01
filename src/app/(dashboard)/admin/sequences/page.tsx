'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';

// ─── Types ────────────────────────────────────────────────────────────────────

type SequenceStep = {
  delay: number;
  templateId: string;
  cancelOnReply: boolean;
};

type Sequence = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  steps: SequenceStep[];
  instances: Array<{
    id: string;
    status: string;
    application: {
      candidate: { firstName: string; lastName: string };
    };
  }>;
};

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
};

// ─── Confirm Modal (no window.confirm) ────────────────────────────────────────

function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Delete
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-600">{message}</p>
    </Modal>
  );
}

// ─── Card Menu ────────────────────────────────────────────────────────────────

function CardMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
      >
        <EllipsisVerticalIcon className="h-5 w-5" />
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
            <button
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <PencilSquareIcon className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              className="w-full text-left px-3 py-2 text-sm text-danger-600 hover:bg-danger-50 flex items-center gap-2"
            >
              <TrashIcon className="h-4 w-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sequence Modal ───────────────────────────────────────────────────────────

function SequenceModal({
  open,
  onClose,
  sequence,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  sequence: Sequence | null; // null = create mode
  onSaved: () => void;
}) {
  const isEdit = !!sequence;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<SequenceStep[]>([
    { delay: 0, templateId: '', cancelOnReply: false },
  ]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load templates on mount
  useEffect(() => {
    if (!open) return;
    setTemplatesLoading(true);
    fetch('/api/email-templates')
      .then((res) => res.json())
      .then((data) => {
        setTemplates(data.templates || []);
        setTemplatesLoading(false);
      })
      .catch(() => setTemplatesLoading(false));
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    if (!open) return;
    if (sequence) {
      setName(sequence.name);
      setDescription(sequence.description || '');
      setIsActive(sequence.isActive);
      setSteps(
        sequence.steps.length > 0
          ? sequence.steps.map((s) => ({ ...s }))
          : [{ delay: 0, templateId: '', cancelOnReply: false }]
      );
    } else {
      setName('');
      setDescription('');
      setIsActive(true);
      setSteps([{ delay: 0, templateId: '', cancelOnReply: false }]);
    }
    setError('');
  }, [open, sequence]);

  const updateStep = (index: number, field: keyof SequenceStep, value: unknown) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { delay: 1, templateId: '', cancelOnReply: false }]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setError('');

    if (!name.trim()) {
      setError('Sequence name is required.');
      return;
    }
    if (steps.length === 0) {
      setError('At least one step is required.');
      return;
    }
    for (let i = 0; i < steps.length; i++) {
      if (!steps[i].templateId) {
        setError(`Step ${i + 1} needs an email template.`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        ...(isEdit ? { id: sequence!.id } : {}),
        name: name.trim(),
        description: description.trim() || null,
        isActive,
        steps: steps.map((s) => ({
          delay: Number(s.delay),
          templateId: s.templateId,
          cancelOnReply: s.cancelOnReply,
        })),
      };

      const res = await fetch('/api/sequences', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Something went wrong.');
        setSaving(false);
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError('Failed to save sequence. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Sequence' : 'Create Sequence'}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {isEdit ? 'Save Changes' : 'Create Sequence'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Error banner */}
        {error && (
          <div className="rounded-lg bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}

        {/* Name */}
        <Input
          label="Sequence Name"
          placeholder="e.g. New Applicant Follow-Up"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        {/* Description */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 focus:border-brand-purple focus:ring-3 focus:ring-brand-purple/10 focus:outline-none placeholder:text-gray-500 resize-none"
            rows={2}
            placeholder="What does this sequence do?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Active toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <span className="text-sm font-medium text-gray-700">Active</span>
          <span className="text-xs text-gray-500">
            Inactive sequences won&apos;t send emails
          </span>
        </label>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Steps ({steps.length})
            </label>
          </div>

          {steps.length === 0 && (
            <p className="text-sm text-gray-500 mb-3">
              No steps yet. Add at least one step.
            </p>
          )}

          <div className="space-y-0">
            {steps.map((step, idx) => (
              <div key={idx} className="relative flex gap-3 pb-4">
                {/* Timeline line + dot */}
                <div className="flex flex-col items-center pt-1">
                  <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  {idx < steps.length - 1 && (
                    <div className="w-0.5 flex-1 bg-purple-100 mt-1" />
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Delay */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-gray-600">
                        Delay (days)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={step.delay}
                        onChange={(e) =>
                          updateStep(idx, 'delay', Math.max(0, parseInt(e.target.value) || 0))
                        }
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-purple focus:ring-3 focus:ring-brand-purple/10 focus:outline-none"
                      />
                    </div>

                    {/* Template */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-gray-600">
                        Email Template
                      </label>
                      <select
                        value={step.templateId}
                        onChange={(e) => updateStep(idx, 'templateId', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-purple focus:ring-3 focus:ring-brand-purple/10 focus:outline-none text-gray-700"
                      >
                        <option value="">
                          {templatesLoading ? 'Loading...' : 'Select template'}
                        </option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    {/* Cancel on reply */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={step.cancelOnReply}
                        onChange={(e) =>
                          updateStep(idx, 'cancelOnReply', e.target.checked)
                        }
                        className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-xs text-gray-600">
                        Cancel on reply
                      </span>
                    </label>

                    {/* Remove step */}
                    {steps.length > 1 && (
                      <button
                        onClick={() => removeStep(idx)}
                        className="p-1 rounded text-gray-400 hover:text-danger-500 hover:bg-danger-50 transition-colors"
                        title="Remove step"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={addStep}
            icon={<PlusIcon className="h-4 w-4" />}
            className="mt-1"
          >
            Add Step
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Sequence | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle loading tracker
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadSequences = useCallback(() => {
    setLoading(true);
    fetch('/api/sequences')
      .then((res) => res.json())
      .then((data) => {
        setSequences(data.sequences || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSequences();
  }, [loadSequences]);

  const handleCreate = () => {
    setEditingSequence(null);
    setModalOpen(true);
  };

  const handleEdit = (seq: Sequence) => {
    setEditingSequence(seq);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sequences?id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDeleteTarget(null);
        loadSequences();
      }
    } catch {
      // Silently fail - user can retry
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (seq: Sequence) => {
    setTogglingId(seq.id);
    try {
      const res = await fetch('/api/sequences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: seq.id, isActive: !seq.isActive }),
      });
      if (res.ok) {
        setSequences((prev) =>
          prev.map((s) =>
            s.id === seq.id ? { ...s, isActive: !s.isActive } : s
          )
        );
      }
    } catch {
      // Silently fail
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
            Email Sequences
          </h1>
          <p className="text-sm text-gray-600">
            Multi-step email sequences with delays and auto-cancel on reply.
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={handleCreate}
          icon={<PlusIcon className="h-4 w-4" />}
        >
          Create Sequence
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sequences.map((sequence) => (
          <Card key={sequence.id}>
            <CardHeader
              title={sequence.name}
              action={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(sequence)}
                    disabled={togglingId === sequence.id}
                    className="transition-opacity disabled:opacity-50"
                  >
                    <Badge
                      variant={sequence.isActive ? 'success' : 'neutral'}
                      dot
                      className="cursor-pointer hover:opacity-80"
                    >
                      {sequence.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </button>
                  <CardMenu
                    onEdit={() => handleEdit(sequence)}
                    onDelete={() => setDeleteTarget(sequence)}
                  />
                </div>
              }
            />
            <CardContent>
              {sequence.description && (
                <p className="text-sm text-gray-600 mb-3">
                  {sequence.description}
                </p>
              )}
              <div className="space-y-2 mb-4">
                <div className="text-xs font-semibold text-gray-700">
                  Steps: {sequence.steps.length}
                </div>
                {sequence.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-gray-600 pl-3 border-l-2 border-brand-purple/20"
                  >
                    Step {idx + 1}: Delay {step.delay} days
                    {step.cancelOnReply && (
                      <span className="text-brand-purple ml-1">
                        (cancel on reply)
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{sequence.instances.length} active instances</span>
                <button
                  onClick={() => handleEdit(sequence)}
                  className="text-brand-purple hover:underline inline-flex items-center gap-1"
                >
                  <PencilSquareIcon className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
        {sequences.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-600">
            No sequences yet. Create your first email sequence to get started.
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <SequenceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sequence={editingSequence}
        onSaved={loadSequences}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Sequence"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
