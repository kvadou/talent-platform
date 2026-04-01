'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  PlusIcon,
  CheckBadgeIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';

type Approver = {
  id: string;
  type: 'user' | 'role';
  name: string;
  email?: string;
};

type Step = {
  id?: string;
  order: number;
  name: string;
  isRequired: boolean;
  approverIds: string[];
  approvers: Approver[];
};

type Workflow = {
  id: string;
  type: 'JOB_APPROVAL' | 'OFFER_APPROVAL';
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  stepCount: number;
  steps: Step[];
};

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

type WorkflowFormData = {
  type: 'JOB_APPROVAL' | 'OFFER_APPROVAL';
  name: string;
  description: string;
};

type StepFormData = {
  name: string;
  approverIds: string[];
  isRequired: boolean;
};

const ROLE_OPTIONS = [
  { id: 'role:HQ_ADMIN', name: 'HQ Admin' },
  { id: 'role:MARKET_ADMIN', name: 'Market Admin' },
  { id: 'role:RECRUITER', name: 'Recruiter' },
  { id: 'role:HIRING_MANAGER', name: 'Hiring Manager' },
];

export default function ApprovalsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  // Form state
  const [formData, setFormData] = useState<WorkflowFormData>({
    type: 'JOB_APPROVAL',
    name: '',
    description: '',
  });
  const [steps, setSteps] = useState<StepFormData[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchWorkflows(), fetchUsers()]);
  }, []);

  async function fetchWorkflows() {
    try {
      const response = await fetch('/api/approvals');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setWorkflows(data.workflows);
    } catch {
      setError('Failed to load approval workflows');
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers() {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setUsers(data.users || []);
    } catch {
      console.error('Failed to load users');
    }
  }

  function openAddModal() {
    setFormData({
      type: 'JOB_APPROVAL',
      name: '',
      description: '',
    });
    setSteps([{ name: '', approverIds: [], isRequired: true }]);
    setShowAddModal(true);
  }

  function openEditModal(workflow: Workflow) {
    setSelectedWorkflow(workflow);
    setFormData({
      type: workflow.type,
      name: workflow.name,
      description: workflow.description || '',
    });
    setSteps(
      workflow.steps.map((s) => ({
        name: s.name,
        approverIds: s.approverIds,
        isRequired: s.isRequired,
      }))
    );
    setShowEditModal(true);
  }

  function openDeleteModal(workflow: Workflow) {
    setSelectedWorkflow(workflow);
    setShowDeleteModal(true);
  }

  function addStep() {
    setSteps([...steps, { name: '', approverIds: [], isRequired: true }]);
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: 'up' | 'down') {
    const newSteps = [...steps];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newSteps.length) return;
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    setSteps(newSteps);
  }

  function updateStep(index: number, field: keyof StepFormData, value: string | string[] | boolean) {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  }

  async function handleCreate() {
    if (!formData.name || steps.length === 0) return;
    setSaving(true);
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          name: formData.name,
          description: formData.description || null,
          steps: steps.filter((s) => s.name),
        }),
      });

      if (!response.ok) throw new Error('Failed to create');
      await fetchWorkflows();
      setShowAddModal(false);
    } catch {
      setError('Failed to create workflow');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!selectedWorkflow || !formData.name) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/approvals/${selectedWorkflow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          steps: steps.filter((s) => s.name),
        }),
      });

      if (!response.ok) throw new Error('Failed to update');
      await fetchWorkflows();
      setShowEditModal(false);
    } catch {
      setError('Failed to update workflow');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedWorkflow) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/approvals/${selectedWorkflow.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      await fetchWorkflows();
      setShowDeleteModal(false);
    } catch {
      setError('Failed to delete workflow');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(workflow: Workflow) {
    try {
      await fetch(`/api/approvals/${workflow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !workflow.isActive }),
      });
      await fetchWorkflows();
    } catch {
      setError('Failed to update workflow');
    }
  }

  // Group workflows by type
  const jobApprovals = workflows.filter((w) => w.type === 'JOB_APPROVAL');
  const offerApprovals = workflows.filter((w) => w.type === 'OFFER_APPROVAL');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Approvals</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage default approval workflows
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Loading approval workflows...
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderWorkflowList = (workflowList: Workflow[], title: string, emptyText: string) => (
    <Card>
      <CardHeader title={title} />
      <CardContent className="p-0">
        {workflowList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{emptyText}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {workflowList.map((workflow) => (
              <div
                key={workflow.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-success-50 rounded-lg">
                    <CheckBadgeIcon className="w-5 h-5 text-success-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{workflow.name}</span>
                      <Badge variant={workflow.isActive ? 'success' : 'neutral'}>
                        {workflow.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {workflow.description || 'No description'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {workflow.stepCount} approval step(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(workflow)}
                    className={`px-3 py-1 text-xs rounded-lg border ${
                      workflow.isActive
                        ? 'border-gray-300 text-gray-600 hover:bg-gray-100'
                        : 'border-success-300 text-success-600 hover:bg-success-50'
                    }`}
                  >
                    {workflow.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => openEditModal(workflow)}
                    className="p-2 text-gray-400 hover:text-brand-purple hover:bg-purple-50 rounded-lg"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openDeleteModal(workflow)}
                    className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStepForm = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Approval Steps</h4>
        <Button size="sm" variant="secondary" onClick={addStep}>
          <PlusIcon className="w-4 h-4 mr-1" />
          Add Step
        </Button>
      </div>
      {steps.length === 0 ? (
        <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500 text-sm">
          No steps added yet. Add at least one approval step.
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Step {index + 1}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveStep(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ArrowUpIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveStep(index, 'down')}
                    disabled={index === steps.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ArrowDownIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeStep(index)}
                    className="p-1 text-gray-400 hover:text-danger-600"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={step.name}
                onChange={(e) => updateStep(index, 'name', e.target.value)}
                placeholder="Step name (e.g., Manager Approval)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <div>
                <label className="block text-xs text-gray-600 mb-1">Approvers</label>
                <select
                  multiple
                  value={step.approverIds}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                    updateStep(index, 'approverIds', selected);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-[80px]"
                >
                  <optgroup label="By Role">
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Specific Users">
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Hold Ctrl/Cmd to select multiple approvers
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={step.isRequired}
                  onChange={(e) => updateStep(index, 'isRequired', e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                Required step
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage default approval workflows
          </p>
        </div>
        <Button onClick={openAddModal}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {renderWorkflowList(
        jobApprovals,
        'Job Approvals',
        'No job approval workflows. Create one to require approval before recruiting.'
      )}

      {renderWorkflowList(
        offerApprovals,
        'Offer Approvals',
        'No offer approval workflows. Create one to require approval before extending offers.'
      )}

      {/* Add Workflow Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Create Approval Workflow"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workflow Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value as 'JOB_APPROVAL' | 'OFFER_APPROVAL',
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="JOB_APPROVAL">Job Approval (to start recruiting)</option>
              <option value="OFFER_APPROVAL">Offer Approval (to extend an offer)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workflow Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="e.g., Standard Job Approval"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Brief description of this workflow..."
            />
          </div>

          {renderStepForm()}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !formData.name || steps.length === 0}
            >
              {saving ? 'Creating...' : 'Create Workflow'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Workflow Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Approval Workflow"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workflow Type
            </label>
            <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
              {formData.type === 'JOB_APPROVAL' ? 'Job Approval' : 'Offer Approval'}
            </div>
            <p className="text-xs text-gray-400 mt-1">Type cannot be changed after creation</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workflow Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {renderStepForm()}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving || !formData.name}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Workflow"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{selectedWorkflow?.name}</strong>? This action
            cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete Workflow'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
