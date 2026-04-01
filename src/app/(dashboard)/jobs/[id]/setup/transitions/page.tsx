'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  PlusIcon,
  TrashIcon,
  BoltIcon,
  EnvelopeIcon,
  CalendarIcon,
  TagIcon,
  ClockIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { AlertModal } from '@/components/ui/AlertModal';

type AutoAdvanceSettings = {
  autoAdvanceEnabled: boolean;
  autoAdvanceMinScore: number;
  autoAdvanceToStageId: string | null;
};

type StageRule = {
  id: string;
  stageId: string;
  trigger: string;
  actionType: string;
  actionTypeEnum: string | null;
  emailTemplateId: string | null;
  emailTemplate: { id: string; name: string } | null;
  taskTemplate: Record<string, unknown> | null;
  tags: string[];
  sequenceId: string | null;
  sequence: { id: string; name: string } | null;
  isActive: boolean;
  order: number;
};

type Stage = {
  id: string;
  name: string;
  order: number;
  stageRules: StageRule[];
};

const TRIGGERS = [
  { value: 'onEnter', label: 'When entering stage' },
  { value: 'onExit', label: 'When leaving stage' },
  { value: 'onSlaBreach', label: 'When SLA is breached' },
];

const ACTION_TYPES = [
  { value: 'SEND_EMAIL', label: 'Send Email', icon: EnvelopeIcon },
  { value: 'SEND_SCHEDULING_LINK', label: 'Send Scheduling Link', icon: CalendarIcon },
  { value: 'CREATE_TASK', label: 'Create Task', icon: ClockIcon },
  { value: 'TAG_CANDIDATE', label: 'Tag Candidate', icon: TagIcon },
];

export default function TransitionsPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [stages, setStages] = useState<Stage[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  // Auto-advance settings
  const [autoAdvance, setAutoAdvance] = useState<AutoAdvanceSettings>({
    autoAdvanceEnabled: false,
    autoAdvanceMinScore: 85,
    autoAdvanceToStageId: null,
  });
  const [savingAutoAdvance, setSavingAutoAdvance] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [showDeleteRuleConfirm, setShowDeleteRuleConfirm] = useState(false);
  const [pendingDeleteRuleId, setPendingDeleteRuleId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [jobRes, templatesRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}`),
        fetch('/api/email-templates'),
      ]);

      if (jobRes.ok) {
        const data = await jobRes.json();

        // Load auto-advance settings
        setAutoAdvance({
          autoAdvanceEnabled: data.autoAdvanceEnabled || false,
          autoAdvanceMinScore: data.autoAdvanceMinScore || 85,
          autoAdvanceToStageId: data.autoAdvanceToStageId || null,
        });

        // Fetch rules for each stage
        const stagesWithRules = await Promise.all(
          (data.stages || []).map(async (stage: Stage) => {
            const rulesRes = await fetch(`/api/jobs/${jobId}/stages/${stage.id}`);
            if (rulesRes.ok) {
              const stageData = await rulesRes.json();
              return { ...stage, stageRules: stageData.stageRules || [] };
            }
            return { ...stage, stageRules: [] };
          })
        );
        setStages(stagesWithRules);
      }

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setEmailTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function saveAutoAdvance() {
    setSavingAutoAdvance(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoAdvanceEnabled: autoAdvance.autoAdvanceEnabled,
          autoAdvanceMinScore: autoAdvance.autoAdvanceMinScore,
          autoAdvanceToStageId: autoAdvance.autoAdvanceToStageId,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save');
      }
    } catch (err) {
      console.error('Failed to save auto-advance settings', err);
      setAlertMsg('Failed to save settings. Please try again.');
    } finally {
      setSavingAutoAdvance(false);
    }
  }

  async function toggleRule(ruleId: string, isActive: boolean) {
    try {
      await fetch(`/api/stage-rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      await fetchData();
    } catch (err) {
      console.error('Failed to toggle rule', err);
    }
  }

  function initiateDeleteRule(ruleId: string) {
    setPendingDeleteRuleId(ruleId);
    setShowDeleteRuleConfirm(true);
  }

  async function deleteRule(ruleId: string) {
    try {
      await fetch(`/api/stage-rules/${ruleId}`, {
        method: 'DELETE',
      });
      await fetchData();
    } catch (err) {
      console.error('Failed to delete rule', err);
    }
  }

  function getActionIcon(actionType: string) {
    const action = ACTION_TYPES.find((a) => a.value === actionType);
    return action?.icon || BoltIcon;
  }

  function getActionLabel(actionType: string) {
    const action = ACTION_TYPES.find((a) => a.value === actionType);
    return action?.label || actionType;
  }

  function getTriggerLabel(trigger: string) {
    const t = TRIGGERS.find((tr) => tr.value === trigger);
    return t?.label || trigger;
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
        <h2 className="text-lg font-semibold text-gray-900">Transitions & Automations</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure automatic actions when candidates move between stages.
        </p>
      </div>

      {/* AI Auto-Advance Section */}
      <Card>
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-purple-500" />
              AI Auto-Advance
            </div>
          }
        />
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Automatically move high-scoring candidates to the next stage when their AI score meets your threshold.
            </p>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAdvance.autoAdvanceEnabled}
                  onChange={(e) =>
                    setAutoAdvance((prev) => ({ ...prev, autoAdvanceEnabled: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-purple rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple"></div>
              </label>
              <span className="text-sm font-medium text-gray-700">
                Enable auto-advance for high scorers
              </span>
            </div>

            {autoAdvance.autoAdvanceEnabled && (
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum AI Score
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="50"
                        max="100"
                        value={autoAdvance.autoAdvanceMinScore}
                        onChange={(e) =>
                          setAutoAdvance((prev) => ({
                            ...prev,
                            autoAdvanceMinScore: parseInt(e.target.value, 10),
                          }))
                        }
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-purple"
                      />
                      <span className="text-sm font-semibold text-gray-900 w-12 text-center">
                        {autoAdvance.autoAdvanceMinScore}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Candidates scoring {autoAdvance.autoAdvanceMinScore}+ will auto-advance
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Advance To Stage
                    </label>
                    <select
                      value={autoAdvance.autoAdvanceToStageId || ''}
                      onChange={(e) =>
                        setAutoAdvance((prev) => ({
                          ...prev,
                          autoAdvanceToStageId: e.target.value || null,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple text-sm"
                    >
                      <option value="">Second stage (default)</option>
                      {stages.slice(1).map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Only advances candidates from the first stage
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={saveAutoAdvance}
                    loading={savingAutoAdvance}
                  >
                    Save Auto-Advance Settings
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {stages.length > 0 ? (
        <div className="space-y-4">
          {stages.map((stage) => (
            <Card key={stage.id}>
              <CardHeader
                title={stage.name}
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedStageId(stage.id);
                      setShowModal(true);
                    }}
                  >
                    <PlusIcon className="w-4 h-4 mr-1.5" />
                    Add Rule
                  </Button>
                }
              />
              <CardContent>
                {stage.stageRules.length > 0 ? (
                  <div className="space-y-2">
                    {stage.stageRules.map((rule) => {
                      const Icon = getActionIcon(rule.actionTypeEnum || rule.actionType);
                      return (
                        <div
                          key={rule.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            rule.isActive
                              ? 'bg-white border-gray-200'
                              : 'bg-gray-50 border-gray-100 opacity-60'
                          }`}
                        >
                          <div
                            className={`p-2 rounded-lg ${
                              rule.isActive
                                ? 'bg-brand-purple/10 text-brand-purple'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="neutral" className="text-xs">
                                {getTriggerLabel(rule.trigger)}
                              </Badge>
                              <span className="text-sm font-medium text-gray-900">
                                {getActionLabel(rule.actionTypeEnum || rule.actionType)}
                              </span>
                            </div>
                            {rule.emailTemplate && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Template: {rule.emailTemplate.name}
                              </p>
                            )}
                            {rule.tags.length > 0 && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Tags: {rule.tags.join(', ')}
                              </p>
                            )}
                          </div>

                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rule.isActive}
                              onChange={(e) => toggleRule(rule.id, e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-purple rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-purple"></div>
                          </label>

                          <button
                            onClick={() => initiateDeleteRule(rule.id)}
                            className="p-1.5 text-gray-400 hover:text-danger-600 rounded hover:bg-danger-50 transition-colors"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No automation rules for this stage.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <BoltIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              No stages configured yet.{' '}
              <a
                href={`/jobs/${jobId}/setup/interview-plan`}
                className="text-brand-purple hover:underline"
              >
                Add stages first
              </a>
            </p>
          </CardContent>
        </Card>
      )}

      <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} title="Error" message={alertMsg || ""} />

      <ConfirmModal
        open={showDeleteRuleConfirm}
        onClose={() => { setShowDeleteRuleConfirm(false); setPendingDeleteRuleId(null); }}
        onConfirm={() => {
          setShowDeleteRuleConfirm(false);
          if (pendingDeleteRuleId) deleteRule(pendingDeleteRuleId);
          setPendingDeleteRuleId(null);
        }}
        title="Delete Rule"
        message="Delete this automation rule?"
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Add Rule Modal */}
      {showModal && selectedStageId && (
        <AddRuleModal
          stageId={selectedStageId}
          emailTemplates={emailTemplates}
          onClose={() => {
            setShowModal(false);
            setSelectedStageId(null);
          }}
          onSave={() => {
            setShowModal(false);
            setSelectedStageId(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function AddRuleModal({
  stageId,
  emailTemplates,
  onClose,
  onSave,
}: {
  stageId: string;
  emailTemplates: { id: string; name: string }[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [trigger, setTrigger] = useState('onEnter');
  const [actionType, setActionType] = useState('SEND_EMAIL');
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/stage-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageId,
          trigger,
          actionType,
          actionTypeEnum: actionType,
          emailTemplateId: actionType === 'SEND_EMAIL' ? emailTemplateId : null,
          tags: actionType === 'TAG_CANDIDATE' ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        }),
      });

      if (res.ok) {
        onSave();
      }
    } catch (err) {
      console.error('Failed to create rule', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Automation Rule</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trigger</label>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
            >
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
            >
              {ACTION_TYPES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {actionType === 'SEND_EMAIL' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Template
              </label>
              <select
                value={emailTemplateId}
                onChange={(e) => setEmailTemplateId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
              >
                <option value="">Select template...</option>
                {emailTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {actionType === 'TAG_CANDIDATE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., interviewed, qualified"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
