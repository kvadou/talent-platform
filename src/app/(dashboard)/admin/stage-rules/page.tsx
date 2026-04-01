'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

// ---------- Types ----------

type StageRule = {
  id: string;
  trigger: string;
  actionType: string;
  isActive: boolean;
  order: number;
  stageId: string;
  emailTemplateId?: string | null;
  sequenceId?: string | null;
  taskTemplate?: Record<string, unknown> | null;
  slaOverride?: Record<string, unknown> | null;
  tags?: string[];
  stage: {
    id: string;
    name: string;
    job: { id: string; title: string };
  };
  emailTemplate?: { id: string; name: string } | null;
  sequence?: { id: string; name: string } | null;
};

type Job = {
  id: string;
  title: string;
  stages: { id: string; name: string; order: number }[];
};

type EmailTemplate = { id: string; name: string };
type Sequence = { id: string; name: string };

type Trigger = 'onEnter' | 'onExit' | 'onSlaBreach';
type ActionType = 'sendEmail' | 'createTask' | 'setSla' | 'tagCandidate' | 'startSequence';

const TRIGGER_OPTIONS: { value: Trigger; label: string }[] = [
  { value: 'onEnter', label: 'When entering stage' },
  { value: 'onExit', label: 'When leaving stage' },
  { value: 'onSlaBreach', label: 'When SLA is breached' },
];

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'sendEmail', label: 'Send Email' },
  { value: 'createTask', label: 'Create Task' },
  { value: 'setSla', label: 'Set SLA' },
  { value: 'tagCandidate', label: 'Tag Candidate' },
  { value: 'startSequence', label: 'Start Sequence' },
];

// ---------- StageRuleModal ----------

function StageRuleModal({
  open,
  onClose,
  onSaved,
  editingRule,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingRule: StageRule | null;
}) {
  const isEdit = !!editingRule;

  // Reference data
  const [jobs, setJobs] = useState<Job[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loadingRef, setLoadingRef] = useState(false);

  // Form state
  const [jobId, setJobId] = useState('');
  const [stageId, setStageId] = useState('');
  const [trigger, setTrigger] = useState<Trigger>('onEnter');
  const [actionType, setActionType] = useState<ActionType>('sendEmail');
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [sequenceId, setSequenceId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [slaHours, setSlaHours] = useState<number>(24);
  const [tagsInput, setTagsInput] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Derived: stages for the selected job
  const selectedJob = jobs.find((j) => j.id === jobId);
  const stages = selectedJob?.stages ?? [];

  // Load reference data when modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingRef(true);
    setError('');

    Promise.all([
      fetch('/api/jobs?limit=100').then((r) => r.json()),
      fetch('/api/email-templates').then((r) => r.json()),
      fetch('/api/sequences').then((r) => r.json()),
    ])
      .then(([jobsData, templatesData, sequencesData]) => {
        setJobs(jobsData.jobs || []);
        setEmailTemplates(templatesData.templates || []);
        setSequences(sequencesData.sequences || []);
      })
      .catch(() => setError('Failed to load form data. Please try again.'))
      .finally(() => setLoadingRef(false));
  }, [open]);

  // Populate form when editing or reset when creating
  useEffect(() => {
    if (!open) return;

    if (editingRule) {
      setJobId(editingRule.stage.job.id);
      setStageId(editingRule.stageId);
      setTrigger(editingRule.trigger as Trigger);
      setActionType(editingRule.actionType as ActionType);
      setEmailTemplateId(editingRule.emailTemplateId || '');
      setSequenceId(editingRule.sequenceId || '');
      setIsActive(editingRule.isActive);

      // Task template
      const tt = editingRule.taskTemplate as Record<string, string> | null;
      setTaskTitle(tt?.title || '');
      setTaskDescription(tt?.description || '');
      setTaskPriority((tt?.priority as 'low' | 'medium' | 'high') || 'medium');

      // SLA
      const sla = editingRule.slaOverride as Record<string, number> | null;
      setSlaHours(sla?.hours ?? 24);

      // Tags
      setTagsInput((editingRule.tags || []).join(', '));
    } else {
      // Reset to defaults
      setJobId('');
      setStageId('');
      setTrigger('onEnter');
      setActionType('sendEmail');
      setEmailTemplateId('');
      setSequenceId('');
      setTaskTitle('');
      setTaskDescription('');
      setTaskPriority('medium');
      setSlaHours(24);
      setTagsInput('');
      setIsActive(true);
    }
  }, [open, editingRule]);

  // When job changes, reset stage (unless editing and it's the initial load)
  const handleJobChange = (newJobId: string) => {
    setJobId(newJobId);
    if (!editingRule || newJobId !== editingRule.stage.job.id) {
      setStageId('');
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!stageId) {
      setError('Please select a job and stage.');
      return;
    }

    // Build action-specific payload
    let emailTplId: string | null = null;
    let seqId: string | null = null;
    let taskTemplate: Record<string, string> | null = null;
    let slaOverride: Record<string, number> | null = null;
    let tags: string[] = [];

    switch (actionType) {
      case 'sendEmail':
        if (!emailTemplateId) {
          setError('Please select an email template.');
          return;
        }
        emailTplId = emailTemplateId;
        break;
      case 'createTask':
        if (!taskTitle.trim()) {
          setError('Please enter a task title.');
          return;
        }
        taskTemplate = {
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          priority: taskPriority,
        };
        break;
      case 'setSla':
        if (!slaHours || slaHours < 1) {
          setError('SLA hours must be at least 1.');
          return;
        }
        slaOverride = { hours: slaHours };
        break;
      case 'tagCandidate':
        tags = tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        if (tags.length === 0) {
          setError('Please enter at least one tag.');
          return;
        }
        break;
      case 'startSequence':
        if (!sequenceId) {
          setError('Please select a sequence.');
          return;
        }
        seqId = sequenceId;
        break;
    }

    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        stageId,
        trigger,
        actionType,
        emailTemplateId: emailTplId,
        taskTemplate,
        slaOverride,
        tags,
        sequenceId: seqId,
        isActive,
      };

      let res: Response;
      if (isEdit) {
        res = await fetch('/api/stage-rules', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingRule.id, ...payload }),
        });
      } else {
        res = await fetch('/api/stage-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save rule');
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Stage Rule' : 'Create Stage Rule'}
      className="max-w-xl"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save Changes' : 'Create Rule'}
          </Button>
        </>
      }
    >
      {loadingRef ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">
              {error}
            </div>
          )}

          {/* Job + Stage selection */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Job"
              value={jobId}
              onChange={(e) => handleJobChange(e.target.value)}
              required
            >
              <option value="">Select a job...</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </Select>

            <Select
              label="Stage"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              required
              disabled={!jobId}
            >
              <option value="">
                {jobId ? 'Select a stage...' : 'Select a job first'}
              </option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Trigger */}
          <Select
            label="Trigger"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as Trigger)}
          >
            {TRIGGER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          {/* Action Type */}
          <Select
            label="Action Type"
            value={actionType}
            onChange={(e) => setActionType(e.target.value as ActionType)}
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          {/* Conditional fields based on action type */}
          {actionType === 'sendEmail' && (
            <Select
              label="Email Template"
              value={emailTemplateId}
              onChange={(e) => setEmailTemplateId(e.target.value)}
              required
            >
              <option value="">Select a template...</option>
              {emailTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}

          {actionType === 'createTask' && (
            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Task Template
              </p>
              <Input
                label="Title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Review candidate resume"
                required
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 focus:border-brand-purple focus:ring-3 focus:ring-brand-purple/10 focus:outline-none placeholder:text-gray-500"
                  rows={3}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Task description..."
                />
              </div>
              <Select
                label="Priority"
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </div>
          )}

          {actionType === 'setSla' && (
            <Input
              label="SLA Hours"
              type="number"
              min={1}
              value={slaHours}
              onChange={(e) => setSlaHours(parseInt(e.target.value, 10) || 0)}
              helperText="Number of hours before this stage triggers an SLA breach."
              required
            />
          )}

          {actionType === 'tagCandidate' && (
            <Input
              label="Tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. priority, follow-up, experienced"
              helperText="Comma-separated list of tags to apply to the candidate."
              required
            />
          )}

          {actionType === 'startSequence' && (
            <Select
              label="Sequence"
              value={sequenceId}
              onChange={(e) => setSequenceId(e.target.value)}
              required
            >
              <option value="">Select a sequence...</option>
              {sequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm font-medium text-gray-700">Rule is active</span>
          </label>
        </form>
      )}
    </Modal>
  );
}

// ---------- Main Page ----------

export default function StageRulesPage() {
  const [rules, setRules] = useState<StageRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<StageRule | null>(null);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<StageRule | null>(null);

  // Toggling active state (track which rule is being toggled)
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchRules = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter === 'ACTIVE') params.set('isActive', 'true');
    if (filter === 'INACTIVE') params.set('isActive', 'false');

    fetch(`/api/stage-rules?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setRules(data.rules || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  function openCreate() {
    setEditingRule(null);
    setModalOpen(true);
  }

  function openEdit(rule: StageRule) {
    setEditingRule(rule);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingRule(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/stage-rules?id=${deleteTarget.id}`, { method: 'DELETE' });
      fetchRules();
    } catch {
      // Silently fail — the rule will still be in the list on next refresh
    }
    setDeleteTarget(null);
  }

  async function toggleActive(rule: StageRule) {
    setTogglingId(rule.id);
    try {
      await fetch('/api/stage-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
      });
      // Optimistically update the local state
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r))
      );
    } catch {
      // no-op
    } finally {
      setTogglingId(null);
    }
  }

  function triggerLabel(trigger: string) {
    switch (trigger) {
      case 'onEnter':
        return 'On Enter Stage';
      case 'onExit':
        return 'On Exit Stage';
      case 'onSlaBreach':
        return 'On SLA Breach';
      default:
        return trigger;
    }
  }

  function actionLabel(action: string) {
    switch (action) {
      case 'sendEmail':
        return 'Send Email';
      case 'createTask':
        return 'Create Task';
      case 'setSla':
        return 'Set SLA';
      case 'tagCandidate':
        return 'Tag Candidate';
      case 'startSequence':
        return 'Start Sequence';
      default:
        return action;
    }
  }

  function detailText(rule: StageRule): string {
    if (rule.emailTemplate) return `Template: ${rule.emailTemplate.name}`;
    if (rule.sequence) return `Sequence: ${rule.sequence.name}`;
    if (rule.actionType === 'setSla' && rule.slaOverride) {
      const sla = rule.slaOverride as Record<string, number>;
      return `${sla.hours ?? '—'}h SLA`;
    }
    if (rule.actionType === 'tagCandidate' && rule.tags?.length) {
      return rule.tags.join(', ');
    }
    if (rule.actionType === 'createTask' && rule.taskTemplate) {
      const tt = rule.taskTemplate as Record<string, string>;
      return tt.title || '—';
    }
    return '—';
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Stage Rules</h1>
          <p className="text-sm text-gray-600">
            Automate actions when candidates move through stages.
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={openCreate}
          icon={<PlusIcon className="h-4 w-4" />}
        >
          Create Rule
        </Button>
      </div>

      <Card>
        <CardHeader
          title="Filters"
          action={
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
            >
              <option value="ALL">All Rules</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </Select>
          }
        />
        <CardContent className="p-0">
          <div className="p-4 lg:p-0">
            <ResponsiveTable
              data={rules}
              columns={[
                {
                  header: 'Stage',
                  accessor: (rule) => (
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {rule.stage.name}
                      </div>
                      <div className="text-xs text-gray-500">{rule.stage.job.title}</div>
                    </div>
                  ),
                },
                {
                  header: 'Trigger',
                  accessor: (rule) => (
                    <span className="text-sm text-gray-700">{triggerLabel(rule.trigger)}</span>
                  ),
                },
                {
                  header: 'Action',
                  accessor: (rule) => (
                    <span className="text-sm text-gray-700">{actionLabel(rule.actionType)}</span>
                  ),
                },
                {
                  header: 'Details',
                  accessor: (rule) => (
                    <span className="text-sm text-gray-600">{detailText(rule)}</span>
                  ),
                },
                {
                  header: 'Status',
                  accessor: (rule) => (
                    <button
                      type="button"
                      onClick={() => toggleActive(rule)}
                      disabled={togglingId === rule.id}
                      className="cursor-pointer disabled:opacity-50"
                      title={`Click to ${rule.isActive ? 'deactivate' : 'activate'}`}
                    >
                      <Badge variant={rule.isActive ? 'success' : 'neutral'} dot>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>
                  ),
                },
                {
                  header: 'Actions',
                  className: 'text-right',
                  accessor: (rule) => (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(rule)}
                        className="inline-flex items-center gap-1 text-sm text-brand-purple hover:underline"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(rule)}
                        className="inline-flex items-center gap-1 text-sm text-danger-600 hover:underline"
                      >
                        <TrashIcon className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  ),
                },
              ]}
              keyExtractor={(rule) => rule.id}
              emptyMessage="No rules configured. Create your first automation rule to get started."
            />
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <StageRuleModal
        open={modalOpen}
        onClose={closeModal}
        onSaved={fetchRules}
        editingRule={editingRule}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Stage Rule"
        message={
          deleteTarget
            ? `Are you sure you want to delete the "${actionLabel(deleteTarget.actionType)}" rule for the "${deleteTarget.stage.name}" stage? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Rule"
        variant="danger"
      />
    </div>
  );
}
