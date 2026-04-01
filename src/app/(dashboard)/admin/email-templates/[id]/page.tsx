'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TemplateEditor } from '@/components/email-templates/TemplateEditor';

interface EmailTemplate {
  id: string;
  name: string;
  type: string;
  description: string | null;
  subject: string;
  body: string;
  scope: string;
  isDefault: boolean;
  jobId: string | null;
  stageId: string | null;
}

export default function EditTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTemplate() {
      try {
        const res = await fetch(`/api/email-templates/${params.id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Template not found');
          } else {
            setError('Failed to load template');
          }
          return;
        }
        const data = await res.json();
        setTemplate(data.template);
      } catch {
        setError('Failed to load template');
      } finally {
        setLoading(false);
      }
    }
    fetchTemplate();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading template...</p>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{error || 'Template not found'}</h2>
          <button
            onClick={() => router.push('/admin/email-templates')}
            className="text-purple-600 hover:text-purple-800"
          >
            Back to templates
          </button>
        </div>
      </div>
    );
  }

  return <TemplateEditor template={template} mode="edit" />;
}
