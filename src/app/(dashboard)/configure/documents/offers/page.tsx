'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  PlusIcon,
  DocumentTextIcon,
  PencilIcon,
  TrashIcon,
  ArrowLeftIcon,
  DocumentDuplicateIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

type OfferTemplate = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  mergeTokens: string[];
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type TemplateFormData = {
  name: string;
  description: string;
  content: string;
  isDefault: boolean;
};

const DEFAULT_TEMPLATE = `Dear {{CANDIDATE_NAME}},

We are pleased to offer you the position of {{JOB_TITLE}} at {{COMPANY_NAME}}.

Your compensation will be:
{{SALARY}}

Your anticipated start date is {{START_DATE}}.

This offer is valid until {{OFFER_EXPIRATION_DATE}}.

Please sign below to accept this offer.

Sincerely,
{{HIRING_MANAGER}}
{{COMPANY_NAME}}`;

export default function OfferTemplatesPage() {
  const [templates, setTemplates] = useState<OfferTemplate[]>([]);
  const [availableMergeTokens, setAvailableMergeTokens] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<OfferTemplate | null>(null);

  // Form state
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    content: DEFAULT_TEMPLATE,
    isDefault: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      const response = await fetch('/api/offer-templates');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setTemplates(data.templates);
      setAvailableMergeTokens(data.availableMergeTokens || []);
    } catch {
      setError('Failed to load offer templates');
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setFormData({
      name: '',
      description: '',
      content: DEFAULT_TEMPLATE,
      isDefault: false,
    });
    setShowAddModal(true);
  }

  function openEditModal(template: OfferTemplate) {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      content: template.content,
      isDefault: template.isDefault,
    });
    setShowEditModal(true);
  }

  function openDeleteModal(template: OfferTemplate) {
    setSelectedTemplate(template);
    setShowDeleteModal(true);
  }

  function openPreviewModal(template: OfferTemplate) {
    setSelectedTemplate(template);
    setShowPreviewModal(true);
  }

  function duplicateTemplate(template: OfferTemplate) {
    setFormData({
      name: `${template.name} (Copy)`,
      description: template.description || '',
      content: template.content,
      isDefault: false,
    });
    setShowAddModal(true);
  }

  function insertToken(token: string) {
    const textarea = document.getElementById('template-content') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent =
        formData.content.substring(0, start) + token + formData.content.substring(end);
      setFormData({ ...formData, content: newContent });
      // Set cursor position after inserted token
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    } else {
      setFormData({ ...formData, content: formData.content + token });
    }
  }

  async function handleCreate() {
    if (!formData.name || !formData.content) return;
    setSaving(true);
    try {
      const response = await fetch('/api/offer-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          content: formData.content,
          isDefault: formData.isDefault,
        }),
      });

      if (!response.ok) throw new Error('Failed to create');
      await fetchTemplates();
      setShowAddModal(false);
    } catch {
      setError('Failed to create template');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!selectedTemplate || !formData.name) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/offer-templates/${selectedTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          content: formData.content,
          isDefault: formData.isDefault,
        }),
      });

      if (!response.ok) throw new Error('Failed to update');
      await fetchTemplates();
      setShowEditModal(false);
    } catch {
      setError('Failed to update template');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/offer-templates/${selectedTemplate.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');
      await fetchTemplates();
      setShowDeleteModal(false);
    } catch {
      setError('Failed to delete template');
    } finally {
      setSaving(false);
    }
  }

  async function toggleDefault(template: OfferTemplate) {
    try {
      await fetch(`/api/offer-templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: !template.isDefault }),
      });
      await fetchTemplates();
    } catch {
      setError('Failed to update template');
    }
  }

  // Get preview content with sample data
  function getPreviewContent(content: string) {
    const sampleData: Record<string, string> = {
      '{{CANDIDATE_NAME}}': 'John Smith',
      '{{CANDIDATE_FIRST_NAME}}': 'John',
      '{{CANDIDATE_LAST_NAME}}': 'Smith',
      '{{CANDIDATE_EMAIL}}': 'john.smith@email.com',
      '{{JOB_TITLE}}': 'Chess Tutor',
      '{{DEPARTMENT}}': 'Education',
      '{{OFFICE_LOCATION}}': 'New York, NY',
      '{{START_DATE}}': 'January 15, 2025',
      '{{SALARY}}': '$50,000 per year',
      '{{HOURLY_RATE}}': '$25.00 per hour',
      '{{SIGN_ON_BONUS}}': '$1,000',
      '{{COMPENSATION_TYPE}}': 'Hourly',
      '{{HIRING_MANAGER}}': 'Sarah Johnson',
      '{{COMPANY_NAME}}': 'Acme Talent',
      '{{OFFER_EXPIRATION_DATE}}': 'January 10, 2025',
      '{{TODAY_DATE}}': new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    };

    let preview = content;
    Object.entries(sampleData).forEach(([token, value]) => {
      preview = preview.replace(new RegExp(token.replace(/[{}]/g, '\\$&'), 'g'), value);
    });
    return preview;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/configure/documents"
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Offer Templates</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage offer letter templates with merge tokens
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Loading offer templates...
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderTemplateForm = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Template Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="e.g., NYC/LA Tutor Offer Letter"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Brief description of this template..."
        />
      </div>

      {/* Merge Tokens */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Available Merge Tokens
        </label>
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
          {availableMergeTokens.map((token) => (
            <button
              key={token}
              type="button"
              onClick={() => insertToken(token)}
              className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700"
            >
              {token}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Click a token to insert it at cursor position
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Template Content *
        </label>
        <textarea
          id="template-content"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={12}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Enter your offer letter template..."
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={formData.isDefault}
          onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
        />
        Set as default template
      </label>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/configure/documents"
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Offer Templates</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage offer letter templates with merge tokens
            </p>
          </div>
        </div>
        <Button onClick={openAddModal}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Template
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

      <Card>
        <CardHeader title="Templates" />
        <CardContent className="p-0">
          {templates.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No offer templates yet. Click &quot;Create Template&quot; to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <DocumentTextIcon className="w-5 h-5 text-brand-purple" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{template.name}</span>
                        {template.isDefault && (
                          <Badge variant="purple">Default</Badge>
                        )}
                        <Badge variant={template.isActive ? 'success' : 'neutral'}>
                          {template.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        {template.description || 'No description'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {template.mergeTokens.length} merge tokens used
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleDefault(template)}
                      className={`p-2 rounded-lg ${
                        template.isDefault
                          ? 'text-yellow-500'
                          : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                      }`}
                      title={template.isDefault ? 'Default template' : 'Set as default'}
                    >
                      {template.isDefault ? (
                        <StarIconSolid className="w-4 h-4" />
                      ) : (
                        <StarIcon className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => openPreviewModal(template)}
                      className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg"
                      title="Preview"
                    >
                      <DocumentTextIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => duplicateTemplate(template)}
                      className="p-2 text-gray-400 hover:text-success-600 hover:bg-success-50 rounded-lg"
                      title="Duplicate"
                    >
                      <DocumentDuplicateIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(template)}
                      className="p-2 text-gray-400 hover:text-brand-purple hover:bg-purple-50 rounded-lg"
                      title="Edit"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(template)}
                      className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                      title="Delete"
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

      {/* Add Template Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Create Offer Template"
      >
        <div className="space-y-4">
          {renderTemplateForm()}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !formData.name || !formData.content}
            >
              {saving ? 'Creating...' : 'Create Template'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Template Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Offer Template"
      >
        <div className="space-y-4">
          {renderTemplateForm()}
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
        title="Delete Template"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{selectedTemplate?.name}</strong>? This action
            cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete Template'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        open={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={`Preview: ${selectedTemplate?.name}`}
      >
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-2">
              Preview with sample data:
            </p>
            <div className="whitespace-pre-wrap text-sm text-gray-700 font-serif">
              {selectedTemplate && getPreviewContent(selectedTemplate.content)}
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
