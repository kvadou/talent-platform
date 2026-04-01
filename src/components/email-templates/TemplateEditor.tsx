'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RichTextEditor, RichTextEditorRef } from '@/components/ui/RichTextEditor';
import { AlertModal } from '@/components/ui/AlertModal';
import { Modal } from '@/components/ui/Modal';
import {
  TEMPLATE_TYPE_LABELS,
  getMergeFieldsForType,
  replaceMergeFields,
} from '@/lib/email-templates/merge-fields';

const PREVIEW_SAMPLE_DATA: Record<string, string> = {
  '{{CANDIDATE_FIRST_NAME}}': 'Jane',
  '{{CANDIDATE_LAST_NAME}}': 'Smith',
  '{{CANDIDATE_NAME}}': 'Jane Smith',
  '{{CANDIDATE_EMAIL_ADDRESS}}': 'jane.smith@example.com',
  '{{CANDIDATE_PHONE}}': '(555) 123-4567',
  '{{PREFERRED_FIRST_NAME}}': 'Jane',
  '{{PREFERRED_FULL_NAME}}': 'Jane Smith',
  '{{JOB_NAME}}': 'Chess Tutor',
  '{{JOB_LOCATION}}': 'Austin, TX',
  '{{OFFICE}}': 'Austin',
  '{{COMPANY}}': 'Acme Talent',
  '{{COMPANY_CAREERS_URL}}': 'https://hiring.acmetalent.com/careers',
  '{{TODAY_DATE}}': new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  '{{STAGE_NAME}}': 'Phone Screen',
  '{{AVAILABILITY_SUBMISSION_LINK}}': 'https://hiring.acmetalent.com/status/example-token',
  '{{SCHEDULING_LINK}}': 'https://hiring.acmetalent.com/status/example-token',
  '{{CALENDAR_LINK}}': '#',
  '{{INTERVIEW_DATE}}': 'March 15, 2026',
  '{{INTERVIEW_TIME}}': '2:00 PM CST',
  '{{INTERVIEW_DURATION}}': '30 minutes',
  '{{INTERVIEW_LOCATION}}': 'Zoom',
  '{{INTERVIEWER_NAME}}': 'Admin User',
  '{{MY_EMAIL_ADDRESS}}': 'recruiting@acmetalent.com',
  '{{MY_FIRST_NAME}}': 'Doug',
  '{{MY_FULL_NAME}}': 'Admin User',
  '{{MY_JOB_TITLE}}': 'Recruiter',
  '{{MY_SIGNATURE}}': 'Admin User',
  '{{RECRUITER}}': 'Admin User',
  '{{COORDINATOR}}': 'Admin User',
  '{{APPLICATION_ID}}': 'APP-12345',
  '{{CANDIDATE_ID}}': 'CAN-67890',
  '{{APPLIED_DATE}}': 'March 1, 2026',
  '{{SOURCE}}': 'Career Page',
  '{{SALARY}}': '$25/hr',
  '{{SALARY_FREQUENCY}}': 'hourly',
  '{{HOURLY_RATE}}': '$25',
  '{{START_DATE}}': 'April 1, 2026',
  '{{EXPIRATION}}': 'March 20, 2026',
  '{{SIGN_ON_BONUS}}': '$0',
  '{{HIRING_MANAGER}}': 'Admin User',
};

interface TemplateEditorProps {
  template?: {
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
  };
  mode: 'create' | 'edit';
  defaultType?: string;
}

const TEMPLATE_TYPES = Object.entries(TEMPLATE_TYPE_LABELS).map(([value, info]) => ({
  value,
  label: info.label,
  description: info.description
}));

export function TemplateEditor({ template, mode, defaultType }: TemplateEditorProps) {
  const router = useRouter();
  const bodyEditorRef = useRef<RichTextEditorRef>(null);

  const [name, setName] = useState(template?.name || '');
  const [type, setType] = useState(template?.type || defaultType || 'CUSTOM');
  const [description, setDescription] = useState(template?.description || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [body, setBody] = useState(template?.body || '');
  const [isDefault, setIsDefault] = useState(template?.isDefault || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<'subject' | 'body'>('body');
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [showTestEmailPrompt, setShowTestEmailPrompt] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Debounced branded preview — fetches full email HTML as candidate would see it
  useEffect(() => {
    if (!body) {
      setPreviewHtml('');
      setPreviewSubject('');
      return;
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch('/api/email-templates/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, body }),
        });
        if (res.ok) {
          const data = await res.json();
          setPreviewHtml(data.html);
          setPreviewSubject(data.subject);
        }
      } catch {
        // Preview is best-effort
      } finally {
        setPreviewLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [subject, body]);

  // Get relevant merge fields for the selected type
  const mergeFields = getMergeFieldsForType(type);

  // Insert merge field at cursor position
  const insertMergeField = useCallback((field: string) => {
    if (activeField === 'subject') {
      const input = document.querySelector('input[name="subject"]') as HTMLInputElement;
      if (input) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const newValue = subject.slice(0, start) + field + subject.slice(end);
        setSubject(newValue);
        // Restore cursor position after render
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(start + field.length, start + field.length);
        }, 0);
      }
    } else {
      // Use the rich text editor's insertText method
      if (bodyEditorRef.current) {
        bodyEditorRef.current.insertText(field);
      }
    }
  }, [activeField, subject]);

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = mode === 'edit'
        ? `/api/email-templates/${template?.id}`
        : '/api/email-templates';

      const res = await fetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          description: description || null,
          subject,
          body,
          isDefault,
          scope: 'GLOBAL'
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save template');
      }

      router.push('/admin/email-templates');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = () => {
    setTestEmailAddress('');
    setShowTestEmailPrompt(true);
  };

  const handleTestEmailSubmit = async (email: string) => {
    setShowTestEmailPrompt(false);
    if (!email) return;

    try {
      const res = await fetch('/api/email-templates/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, to: email })
      });

      if (res.ok) {
        setAlertMsg('Test email sent!');
      } else {
        setAlertMsg('Failed to send test email');
      }
    } catch {
      setAlertMsg('Failed to send test email');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
            {mode === 'edit' ? 'Edit Email Template' : 'Create Email Template'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {mode === 'edit' ? 'Update template details and content' : 'Create a new email template with merge fields'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Info */}
          <Card>
            <CardHeader title="Template Details" />
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Parker Video Availability"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type <span className="text-danger-500">*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {TEMPLATE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Set as default for this type</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="When is this template used?"
                />
              </div>
            </CardContent>
          </Card>

          {/* Email Content */}
          <Card>
            <CardHeader title="Email Content" />
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Subject <span className="text-danger-500">*</span>
                </label>
                <input
                  name="subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  onFocus={() => setActiveField('subject')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  placeholder="{{COMPANY}} - Interview Request"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Body <span className="text-danger-500">*</span>
                </label>
                <div className="bg-success-50 border border-success-200 rounded-lg p-3 mb-2 text-sm">
                  <p className="font-medium text-success-800 mb-1">Edit the copy for the email below.</p>
                  <p className="text-success-700">
                    Click merge fields on the right to insert them at your cursor position.
                  </p>
                </div>
                <div onFocus={() => setActiveField('body')}>
                <RichTextEditor
                  ref={bodyEditorRef}
                  value={body}
                  onChange={setBody}
                  placeholder={`Hi {{CANDIDATE_FIRST_NAME}},

Thanks for applying to the {{JOB_NAME}} role at {{COMPANY}}! We're excited to move forward with the interview process.

Please click the link below to select your availability:
{{AVAILABILITY_SUBMISSION_LINK}}

Regards,
{{MY_SIGNATURE}}`}
                  minHeight="400px"
                />
              </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={handleTestSend}>
                  Send Test Email
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Merge Fields Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Merge Fields" subtitle="Click to insert at cursor" />
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {Object.entries(mergeFields).map(([categoryKey, category]) => (
                <div key={categoryKey} className="border-b border-gray-100 last:border-b-0">
                  <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {category.label}
                  </div>
                  <div className="p-2">
                    {Object.entries(category.fields).map(([field, label]) => (
                      <button
                        key={field}
                        onClick={() => insertMergeField(field)}
                        className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-purple-50 hover:text-purple-700 transition-colors group"
                      >
                        <span className="font-mono text-xs text-purple-600 group-hover:text-purple-800">
                          {field}
                        </span>
                        <span className="block text-xs text-gray-500 group-hover:text-gray-700">
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Preview — merge fields resolved */}
          <Card>
            <CardHeader title="Quick Preview" subtitle="Merge fields resolved" />
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-500">Subject:</span>
                  <p className="font-medium text-gray-900">
                    {subject ? replaceMergeFields(subject, PREVIEW_SAMPLE_DATA) : '(no subject)'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full Branded Email Preview */}
      <Card>
        <CardHeader
          title="Email Preview"
          subtitle="Exactly what the candidate will receive"
        />
        <CardContent>
          {previewLoading && !previewHtml && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            </div>
          )}
          {previewHtml ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 font-medium">Subject:</span>
                <span className="text-gray-900">{previewSubject || '(no subject)'}</span>
                {previewLoading && (
                  <div className="w-3 h-3 border border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                )}
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
                <iframe
                  srcDoc={previewHtml}
                  className="w-full border-0"
                  style={{ height: '700px' }}
                  title="Email preview"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          ) : !previewLoading ? (
            <div className="text-center py-12 text-gray-400">
              <p>Start typing email content above to see a live preview</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} title="Notice" message={alertMsg || ""} />

      <Modal open={showTestEmailPrompt} onClose={() => setShowTestEmailPrompt(false)} title="Send Test Email">
        <input
          type="email"
          value={testEmailAddress}
          onChange={(e) => setTestEmailAddress(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Enter email address..."
          onKeyDown={(e) => e.key === 'Enter' && handleTestEmailSubmit(testEmailAddress)}
          autoFocus
        />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setShowTestEmailPrompt(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={() => handleTestEmailSubmit(testEmailAddress)} className="px-4 py-2 text-white bg-purple-700 rounded-lg hover:bg-purple-800">Send Test</button>
        </div>
      </Modal>
    </div>
  );
}
