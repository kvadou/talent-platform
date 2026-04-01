'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { TEMPLATE_TYPE_LABELS } from '@/lib/email-templates/merge-fields';

type EmailTemplate = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  subject: string;
  scope: string;
  isDefault: boolean;
  updatedAt: string;
  job?: { id: string; title: string };
  stage?: { id: string; name: string };
};

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetch('/api/email-templates')
      .then((res) => res.json())
      .then((data) => {
        setTemplates(data.templates || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Group templates by type
  const groupedTemplates = templates.reduce((acc, template) => {
    const type = template.type || 'CUSTOM';
    if (!acc[type]) acc[type] = [];
    acc[type].push(template);
    return acc;
  }, {} as Record<string, EmailTemplate[]>);

  // Sort types to show most common first
  const typeOrder = [
    'APPLICATION_RECEIVED',
    'AVAILABILITY_REQUEST',
    'INTERVIEW_CONFIRMATION',
    'INTERVIEW_REMINDER',
    'SCHEDULING_LINK',
    'APPLICATION_REJECTION',
    'OFFER_EXTENDED',
    'SCORECARD_REMINDER',
    'CUSTOM'
  ];

  const sortedTypes = Object.keys(groupedTemplates).sort((a, b) => {
    const aIndex = typeOrder.indexOf(a);
    const bIndex = typeOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmDelete({ id, name });
  };

  const confirmDeleteHandler = async () => {
    if (!confirmDelete) return;
    const { id } = confirmDelete;
    setConfirmDelete(null);

    try {
      const res = await fetch(`/api/email-templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates(templates.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete template', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Email Templates</h1>
        </div>
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Loading templates...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Email Templates</h1>
          <p className="text-sm text-gray-600">
            Manage email templates with merge fields for automated communications.
          </p>
        </div>
        <Link href="/admin/email-templates/new">
          <Button className="w-full sm:w-auto">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Template
          </Button>
        </Link>
      </div>

      {/* Templates by Type */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
            <p className="text-gray-500 mb-4">Create your first email template to get started.</p>
            <Link href="/admin/email-templates/new">
              <Button>Create Template</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedTypes.map((type) => {
            const typeTemplates = groupedTemplates[type];
            const typeInfo = TEMPLATE_TYPE_LABELS[type] || { label: type, description: '' };

            return (
              <Card key={type}>
                <CardHeader
                  title={typeInfo.label}
                  subtitle={typeInfo.description}
                  action={
                    <Link href={`/admin/email-templates/new?type=${type}`}>
                      <Button size="sm" variant="ghost">
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New
                      </Button>
                    </Link>
                  }
                />
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-100">
                    {typeTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">
                              {template.name}
                            </span>
                            {template.isDefault && (
                              <Badge variant="info" className="text-xs">Default</Badge>
                            )}
                            {template.scope !== 'GLOBAL' && (
                              <Badge variant="neutral" className="text-xs">{template.scope}</Badge>
                            )}
                          </div>
                          {template.job && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Job: {template.job.title}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                          <span className="text-sm text-gray-500 hidden sm:block">
                            {template.updatedAt ? formatDate(template.updatedAt) : 'Never'}
                          </span>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/email-templates/${template.id}`}
                              className="p-1.5 text-gray-400 hover:text-purple-600 rounded"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </Link>
                            <button
                              onClick={() => handleDelete(template.id, template.name)}
                              className="p-1.5 text-gray-400 hover:text-danger-600 rounded"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteHandler}
        title="Delete Template"
        message={`Delete template "${confirmDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
