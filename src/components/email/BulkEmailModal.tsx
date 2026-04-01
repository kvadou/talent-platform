'use client';

import { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { RichTextEditor, RichTextEditorRef } from '@/components/ui/RichTextEditor';
import { EnvelopeIcon, PaperAirplaneIcon, EyeIcon, XMarkIcon, BookmarkIcon, PaperClipIcon, TrashIcon } from '@heroicons/react/24/outline';

interface Recipient {
  id: string;
  name: string;
  email: string;
  jobTitle?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  type: string;
  subject: string;
  body: string;
}

interface Attachment {
  name: string;
  type: string;
  size: number;
  content: string; // base64 encoded
}

interface BulkEmailModalProps {
  open: boolean;
  onClose: () => void;
  recipients: Recipient[];
  onSend: (data: { subject: string; body: string; recipientIds: string[]; fromAddress?: string; cc?: string[]; attachments?: Attachment[] }) => Promise<void>;
  defaultTemplateType?: string; // Pre-select template of this type (e.g., 'REJECTION')
  currentUserEmail?: string; // For CC self option
}

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB total (Postmark limit)

// Available sender addresses
const FROM_ADDRESSES = [
  { value: 'RECRUITING', label: 'Recruiting', address: 'Acme Talent Recruiting <recruiting@acmetalent.com>' },
  { value: 'ONBOARDING', label: 'Onboarding', address: 'Acme Talent Onboarding <onboarding@acmetalent.com>' },
];

// Standard merge fields matching template editor format
const MERGE_FIELDS = [
  { label: 'First Name', field: '{{CANDIDATE_FIRST_NAME}}' },
  { label: 'Last Name', field: '{{CANDIDATE_LAST_NAME}}' },
  { label: 'Full Name', field: '{{CANDIDATE_NAME}}' },
  { label: 'Job Title', field: '{{JOB_NAME}}' },
  { label: 'Company', field: '{{COMPANY}}' },
  { label: 'My Name', field: '{{MY_FULL_NAME}}' },
];

export function BulkEmailModal({ open, onClose, recipients, onSend, defaultTemplateType, currentUserEmail }: BulkEmailModalProps) {
  const bodyEditorRef = useRef<RichTextEditorRef>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [fromAddress, setFromAddress] = useState('RECRUITING');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  // CC options
  const [ccSelf, setCcSelf] = useState(false);
  const [additionalCc, setAdditionalCc] = useState('');
  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch templates on mount
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('/api/email-templates');
        if (res.ok) {
          const data = await res.json();
          const fetchedTemplates = data.templates || [];
          setTemplates(fetchedTemplates);

          // Pre-select template by type if defaultTemplateType is provided
          if (defaultTemplateType && fetchedTemplates.length > 0) {
            const matchingTemplate = fetchedTemplates.find((t: EmailTemplate) => t.type === defaultTemplateType);
            if (matchingTemplate) {
              setSelectedTemplateId(matchingTemplate.id);
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch templates:', e);
      }
    }
    if (open) {
      fetchTemplates();
    }
  }, [open, defaultTemplateType]);

  // Apply template when selected
  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find((t) => t.id === selectedTemplateId);
      if (template) {
        setSubject(template.subject);
        setBody(template.body);
      }
    }
  }, [selectedTemplateId, templates]);

  const insertMergeField = (field: string) => {
    // Use the rich text editor's insertText method
    if (bodyEditorRef.current) {
      bodyEditorRef.current.insertText(field);
    } else {
      // Fallback: append to body
      setBody((prev) => prev + field);
    }
  };

  // File attachment handling
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentSize = attachments.reduce((sum, a) => sum + a.size, 0);
    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      // Check total size
      if (currentSize + newAttachments.reduce((sum, a) => sum + a.size, 0) + file.size > MAX_ATTACHMENT_SIZE) {
        setError('Total attachment size cannot exceed 10MB');
        break;
      }

      // Read file as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix (e.g., "data:application/pdf;base64,")
          const base64Content = result.split(',')[1];
          resolve(base64Content);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      newAttachments.push({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        content: base64,
      });
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setError('Subject and body are required');
      return;
    }
    if (recipients.length === 0) {
      setError('No recipients selected');
      return;
    }

    setSending(true);
    setError('');

    try {
      // Build CC list
      const ccList: string[] = [];
      if (ccSelf && currentUserEmail) {
        ccList.push(currentUserEmail);
      }
      if (additionalCc.trim()) {
        // Split by comma or semicolon, trim whitespace
        const additionalEmails = additionalCc
          .split(/[,;]/)
          .map((e) => e.trim())
          .filter((e) => e.includes('@'));
        ccList.push(...additionalEmails);
      }

      await onSend({
        subject,
        body,
        recipientIds: recipients.map((r) => r.id),
        fromAddress,
        cc: ccList.length > 0 ? ccList : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim() || !subject.trim() || !body.trim()) {
      setError('Template name, subject, and body are required');
      return;
    }

    setSavingTemplate(true);
    setError('');

    try {
      const res = await fetch('/api/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateName.trim(),
          type: 'CUSTOM',
          subject,
          body,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save template');
      }

      // Refresh templates list
      const templatesRes = await fetch('/api/email-templates');
      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.templates || []);
      }

      setShowSaveTemplate(false);
      setNewTemplateName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  // Helper to apply merge fields for preview (supports both UPPERCASE and legacy lowercase)
  const applyPreviewMergeFields = (template: string, data: {
    firstName: string;
    lastName: string;
    fullName: string;
    jobTitle: string;
  }) => {
    return template
      // UPPERCASE format (standard)
      .replace(/\{\{CANDIDATE_FIRST_NAME\}\}/g, data.firstName)
      .replace(/\{\{CANDIDATE_LAST_NAME\}\}/g, data.lastName)
      .replace(/\{\{CANDIDATE_NAME\}\}/g, data.fullName)
      .replace(/\{\{PREFERRED_FIRST_NAME\}\}/g, data.firstName)
      .replace(/\{\{PREFERRED_FULL_NAME\}\}/g, data.fullName)
      .replace(/\{\{JOB_NAME\}\}/g, data.jobTitle)
      .replace(/\{\{COMPANY\}\}/g, 'Acme Talent')
      .replace(/\{\{MY_FULL_NAME\}\}/g, 'Acme Talent Recruiting')
      .replace(/\{\{MY_FIRST_NAME\}\}/g, 'Acme Talent')
      .replace(/\{\{TODAY_DATE\}\}/g, new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
      // lowercase format (legacy)
      .replace(/\{\{first_name\}\}/g, data.firstName)
      .replace(/\{\{last_name\}\}/g, data.lastName)
      .replace(/\{\{full_name\}\}/g, data.fullName)
      .replace(/\{\{job_title\}\}/g, data.jobTitle)
      .replace(/\{\{company\}\}/g, 'Acme Talent');
  };

  // Generate preview HTML with sample data
  const getPreviewHtml = () => {
    const sampleRecipient = recipients[0] || {
      name: 'John Doe',
      email: 'john@example.com',
      jobTitle: 'Chess Tutor',
    };
    const [firstName, ...lastParts] = sampleRecipient.name.split(' ');
    const lastName = lastParts.join(' ') || 'Doe';

    return applyPreviewMergeFields(body, {
      firstName: firstName || 'John',
      lastName,
      fullName: sampleRecipient.name || 'John Doe',
      jobTitle: sampleRecipient.jobTitle || 'Position',
    });
  };

  const previewSubject = () => {
    const sampleRecipient = recipients[0] || { name: 'John Doe', jobTitle: 'Chess Tutor' };
    const [firstName, ...lastParts] = sampleRecipient.name.split(' ');
    const lastName = lastParts.join(' ') || 'Doe';

    return applyPreviewMergeFields(subject, {
      firstName: firstName || 'John',
      lastName,
      fullName: sampleRecipient.name || 'John Doe',
      jobTitle: sampleRecipient.jobTitle || 'Position',
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Send Email to ${recipients.length} Candidate${recipients.length !== 1 ? 's' : ''}`}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="p-3 bg-danger-50 text-danger-700 text-sm rounded-lg border border-danger-200">
            {error}
          </div>
        )}

        {/* Recipients summary */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <EnvelopeIcon className="h-4 w-4 inline mr-1" />
            Sending to{' '}
            <span className="font-medium text-gray-900">{recipients.length} recipient{recipients.length !== 1 ? 's' : ''}</span>
            {recipients.length <= 5 && (
              <span className="text-gray-500">
                {' '}
                ({recipients.map((r) => r.name).join(', ')})
              </span>
            )}
          </p>
        </div>

        {/* Template and From Address - side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template (optional)</label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
            >
              <option value="">Start from scratch...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.type.replace(/_/g, ' ').toLowerCase()})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <select
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
            >
              {FROM_ADDRESSES.map((addr) => (
                <option key={addr.value} value={addr.value}>
                  {addr.label} ({addr.address.split('<')[1]?.replace('>', '') || addr.address})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CC Options */}
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            {currentUserEmail && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ccSelf}
                  onChange={(e) => setCcSelf(e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">CC myself ({currentUserEmail})</span>
              </label>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional CC (optional)</label>
            <input
              type="text"
              value={additionalCc}
              onChange={(e) => setAdditionalCc(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Separate multiple addresses with commas</p>
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject..."
            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
          />
        </div>

        {/* Merge fields */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 mr-2">Insert:</span>
          {MERGE_FIELDS.map((mf) => (
            <button
              key={mf.field}
              type="button"
              onClick={() => insertMergeField(mf.field)}
              className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
            >
              {mf.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <RichTextEditor
            ref={bodyEditorRef}
            value={body}
            onChange={setBody}
            placeholder="Write your email message here. Use merge fields above to personalize."
            minHeight="250px"
          />
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Attachments (optional)</label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <PaperClipIcon className="h-4 w-4 text-gray-500" />
            Attach files
          </button>
          {attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {attachments.map((attachment, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <PaperClipIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{attachment.name}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0">({formatFileSize(attachment.size)})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="p-1 text-gray-400 hover:text-danger-500 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <p className="text-xs text-gray-500">
                Total: {formatFileSize(attachments.reduce((sum, a) => sum + a.size, 0))} / 10 MB
              </p>
            </div>
          )}
        </div>

        {/* Preview toggle and Save as template */}
        {body && (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800"
            >
              {showPreview ? <XMarkIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
            <button
              type="button"
              onClick={() => setShowSaveTemplate(!showSaveTemplate)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
            >
              <BookmarkIcon className="h-4 w-4" />
              Save as template
            </button>
          </div>
        )}

        {/* Save as template form */}
        {showSaveTemplate && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Follow-up Email, Second Interview Invite"
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowSaveTemplate(false); setNewTemplateName(''); }}
                disabled={savingTemplate}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveTemplate}
                loading={savingTemplate}
                disabled={!newTemplateName.trim()}
              >
                Save Template
              </Button>
            </div>
          </div>
        )}

        {/* Preview - using iframe sandbox for safe HTML rendering */}
        {showPreview && body && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Subject:</span> {previewSubject()}
              </p>
            </div>
            <iframe
              sandbox=""
              srcDoc={`
                <!DOCTYPE html>
                <html>
                  <head>
                    <style>
                      body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.5; color: #1f2937; padding: 16px; margin: 0; }
                      p { margin: 0 0 1em 0; }
                    </style>
                  </head>
                  <body>${getPreviewHtml()}</body>
                </html>
              `}
              className="w-full h-48 bg-white"
              title="Email preview"
            />
            <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 border-t border-gray-200">
              Preview shown for: {recipients[0]?.name || 'Sample Recipient'}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
        <Button variant="outline" onClick={onClose} disabled={sending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSend}
          loading={sending}
          icon={<PaperAirplaneIcon className="h-4 w-4" />}
        >
          {sending ? 'Sending...' : `Send to ${recipients.length}`}
        </Button>
      </div>
    </Modal>
  );
}
