'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  PlusIcon,
  EnvelopeIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

type EmailTemplate = {
  id: string;
  name: string;
  type: string;
  subject: string;
  isDefault: boolean;
  description: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  APPLICATION_RECEIVED: 'Application',
  APPLICATION_REJECTION: 'Rejection',
  AVAILABILITY_REQUEST: 'Scheduling',
  INTERVIEW_CONFIRMATION: 'Interview',
  INTERVIEW_REMINDER: 'Interview',
  INTERVIEW_CANCELLATION: 'Interview',
  INTERVIEW_RESCHEDULE: 'Interview',
  SCHEDULING_LINK: 'Scheduling',
  STAGE_CHANGE: 'Stage Change',
  OFFER_EXTENDED: 'Offer',
  OFFER_ACCEPTED: 'Offer',
  OFFER_DECLINED: 'Offer',
  SCORECARD_REMINDER: 'Internal',
  INTERVIEWER_INVITE: 'Internal',
  REFERRAL_RECEIPT: 'General',
  CUSTOM: 'Custom',
};

const CATEGORY_FILTERS: Record<string, string[]> = {
  ALL: [],
  Application: ['APPLICATION_RECEIVED', 'APPLICATION_REJECTION'],
  Interview: ['INTERVIEW_CONFIRMATION', 'INTERVIEW_REMINDER', 'INTERVIEW_CANCELLATION', 'INTERVIEW_RESCHEDULE'],
  Scheduling: ['AVAILABILITY_REQUEST', 'SCHEDULING_LINK'],
  Offer: ['OFFER_EXTENDED', 'OFFER_ACCEPTED', 'OFFER_DECLINED'],
  'Stage Change': ['STAGE_CHANGE'],
  Custom: ['CUSTOM'],
};

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/email-templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  }

  function deleteTemplate(id: string) {
    setConfirmDeleteId(id);
  }

  async function confirmDeleteTemplate() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);

    try {
      const res = await fetch(`/api/email-templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  }

  const filteredTemplates = category === 'ALL'
    ? templates
    : templates.filter((t) => (CATEGORY_FILTERS[category] || []).includes(t.type));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Email Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure the email templates sent to candidates. Edit any template to customize the copy, subject line, and merge fields.
          </p>
        </div>
        <Link href="/admin/email-templates/new">
          <Button>
            <PlusIcon className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </Link>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {Object.keys(CATEGORY_FILTERS).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              category === cat
                ? 'bg-brand-purple text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader title={`${filteredTemplates.length} Template${filteredTemplates.length !== 1 ? 's' : ''}`} />
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <EnvelopeIcon className="w-5 h-5 text-brand-purple" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {template.name}
                      </span>
                      <Badge variant="neutral">
                        {TYPE_LABELS[template.type] || template.type}
                      </Badge>
                      {template.isDefault && (
                        <Badge variant="success">Default</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Subject: {template.subject}
                    </p>
                    {template.description && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {template.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/admin/email-templates/${template.id}`}>
                    <button className="p-2 text-gray-400 hover:text-brand-purple hover:bg-purple-50 rounded-lg transition-colors">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                  </Link>
                  {!template.isDefault && (
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {filteredTemplates.length === 0 && (
              <div className="p-8 text-center">
                <EnvelopeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No email templates found.</p>
                <p className="text-sm text-gray-400 mt-1">
                  Run the seed script to populate default templates.
                </p>
                <Link href="/admin/email-templates/new">
                  <Button variant="outline" size="sm" className="mt-3">
                    <PlusIcon className="w-4 h-4 mr-1.5" />
                    Create Template
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDeleteTemplate}
        title="Delete Template"
        message="Are you sure you want to delete this template? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
