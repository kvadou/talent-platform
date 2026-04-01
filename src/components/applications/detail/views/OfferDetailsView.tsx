'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { CreateOfferModal } from '../modals/CreateOfferModal';
import { BackgroundCheckSection } from '../BackgroundCheckSection';
import {
  DocumentTextIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

type Offer = {
  id: string;
  compensationType: string;
  hourlyRate: number | null;
  salary: number | null;
  salaryFrequency: string | null;
  currency: string;
  signOnBonus: number | null;
  employmentType: string;
  startDate: string | null;
  expiresAt: string | null;
  status: string;
  version: number;
  dropboxSignRequestId?: string | null; // Legacy - kept for backwards compat
  esignDocumentId?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
};

type Template = {
  id: string;
  title: string;
  signerRoles: Array<{ name: string; order: number }>;
  customFields: Array<{ name: string; type: string }>;
};

type SignatureStatus = {
  requestId: string;
  isComplete: boolean;
  isDeclined: boolean;
  signatures: Array<{
    email: string;
    name: string;
    status: string;
    signedAt: string | null;
  }>;
  createdAt: string;
};

type Props = {
  applicationId: string;
  candidateId: string;
  offer: Offer | null;
  candidateName: string;
  jobTitle: string;
  defaultTemplateId?: string | null;
  onRefresh: () => void;
};

export function OfferDetailsView({ applicationId, candidateId, offer, candidateName, jobTitle, defaultTemplateId, onRefresh }: Props) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [signatureStatus, setSignatureStatus] = useState<SignatureStatus | null>(null);
  const [submittingForApproval, setSubmittingForApproval] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Fetch E-Sign templates
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('/api/integrations/esign?action=templates');
        if (res.ok) {
          const data = await res.json();
          setIsConfigured(data.configured);
          setTemplates(data.templates || []);
          // Use job's default template if configured, otherwise first template
          if (defaultTemplateId && data.templates?.some((t: Template) => t.id === defaultTemplateId)) {
            setSelectedTemplate(defaultTemplateId);
          } else if (data.templates?.length > 0) {
            setSelectedTemplate(data.templates[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to fetch templates:', e);
      }
    }
    fetchTemplates();
  }, [defaultTemplateId]);

  // Fetch signature status if offer is sent
  useEffect(() => {
    async function fetchSignatureStatus() {
      if (!offer?.id || offer.status !== 'SENT') return;

      setLoading(true);
      try {
        const res = await fetch(`/api/integrations/esign?offerId=${offer.id}`);
        if (res.ok) {
          const data = await res.json();
          setSignatureStatus(data.signatureStatus);
        }
      } catch (e) {
        console.error('Failed to fetch signature status:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchSignatureStatus();
  }, [offer?.id, offer?.status]);

  const handleSendForSignature = async () => {
    if (!offer || !selectedTemplate) return;

    setSending(true);
    setError('');

    try {
      // Pass resend: true if the offer was already sent (has a signature request)
      const isResend = offer.status === 'SENT' || !!offer.esignDocumentId || !!offer.dropboxSignRequestId;

      const res = await fetch('/api/integrations/esign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: offer.id,
          templateId: selectedTemplate,
          resend: isResend,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send signature request');
      }

      setIsSignatureModalOpen(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!offer) return;

    setSubmittingForApproval(true);
    setError('');

    try {
      const res = await fetch(`/api/offers/${offer.id}/submit-for-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit for approval');
      }

      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setSubmittingForApproval(false);
    }
  };

  const handleApprove = async () => {
    if (!offer) return;

    setApproving(true);
    setError('');

    try {
      const res = await fetch(`/api/offers/${offer.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve offer');
      }

      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!offer || !rejectReason.trim()) return;

    setRejecting(true);
    setError('');

    try {
      const res = await fetch(`/api/offers/${offer.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reject offer');
      }

      setIsRejectModalOpen(false);
      setRejectReason('');
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reject');
    } finally {
      setRejecting(false);
    }
  };

  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount === null) return '--';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
    switch (status) {
      case 'ACCEPTED':
        return 'success';
      case 'SENT':
      case 'APPROVED':
        return 'info';
      case 'PENDING_APPROVAL':
      case 'DRAFT':
        return 'warning';
      case 'DECLINED':
      case 'EXPIRED':
      case 'CANCELLED':
        return 'error';
      default:
        return 'neutral';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (!offer) {
    return (
      <div className="space-y-6">
        {/* Background Check Section - Always visible */}
        <BackgroundCheckSection
          candidateId={candidateId}
          candidateName={candidateName}
        />

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Offer details</h2>

          <div className="py-16 text-center">
            <div className="w-32 h-32 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-600 mb-6">No offers have been created for this job</p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Create offer
            </Button>
          </div>
        </div>

        <CreateOfferModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          applicationId={applicationId}
          candidateName={candidateName}
          jobTitle={jobTitle}
          onOfferCreated={() => {
            setIsCreateModalOpen(false);
            onRefresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Background Check Section - Always visible */}
      <BackgroundCheckSection
        candidateId={candidateId}
        candidateName={candidateName}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Offer details</h2>
        <Badge variant={getStatusVariant(offer.status)}>
          {formatStatus(offer.status)}
        </Badge>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Compensation */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Compensation</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Type</p>
                <p className="text-sm font-medium text-gray-900">
                  {offer.compensationType.charAt(0) + offer.compensationType.slice(1).toLowerCase()}
                </p>
              </div>
              {offer.compensationType === 'HOURLY' && (
                <div>
                  <p className="text-xs text-gray-500">Hourly Rate</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatCurrency(offer.hourlyRate, offer.currency)}/hr
                  </p>
                </div>
              )}
              {offer.compensationType === 'SALARY' && (
                <>
                  <div>
                    <p className="text-xs text-gray-500">Salary</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(offer.salary, offer.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Frequency</p>
                    <p className="text-sm font-medium text-gray-900">
                      {offer.salaryFrequency || 'Annually'}
                    </p>
                  </div>
                </>
              )}
              {offer.signOnBonus && (
                <div>
                  <p className="text-xs text-gray-500">Sign-on Bonus</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatCurrency(offer.signOnBonus, offer.currency)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Employment Details */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Employment Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Employment Type</p>
                <p className="text-sm font-medium text-gray-900">
                  {offer.employmentType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Start Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {offer.startDate ? new Date(offer.startDate).toLocaleDateString() : 'TBD'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Offer Expires</p>
                <p className="text-sm font-medium text-gray-900">
                  {offer.expiresAt ? new Date(offer.expiresAt).toLocaleDateString() : 'No expiration'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Version</p>
                <p className="text-sm font-medium text-gray-900">v{offer.version}</p>
              </div>
            </div>
          </div>

          {/* Approval Status (when pending approval) */}
          {offer.status === 'PENDING_APPROVAL' && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Approval Status</h3>
              <div className="bg-warning-50 border border-warning-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ClockIcon className="h-5 w-5 text-warning-600" />
                  <span className="text-sm font-medium text-warning-900">Awaiting Approval</span>
                </div>
                <p className="text-sm text-warning-700 mb-4">
                  This offer requires approval before it can be sent to the candidate.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleApprove}
                    loading={approving}
                    disabled={approving || rejecting}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-danger-600 border-danger-300 hover:bg-danger-50"
                    onClick={() => setIsRejectModalOpen(true)}
                    disabled={approving || rejecting}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Signature Status (when sent) */}
          {offer.status === 'SENT' && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Signature Status</h3>
              {loading ? (
                <div className="animate-pulse h-16 bg-gray-100 rounded" />
              ) : signatureStatus ? (
                <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ClockIcon className="h-5 w-5 text-cyan-600" />
                    <span className="text-sm font-medium text-cyan-900">Awaiting Signature</span>
                  </div>
                  {signatureStatus.signatures.map((sig, i) => (
                    <div key={i} className="text-sm text-cyan-700">
                      {sig.name} ({sig.email}) - {sig.status.replace(/_/g, ' ')}
                    </div>
                  ))}
                  <p className="text-xs text-cyan-600 mt-2">
                    Sent {new Date(signatureStatus.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Offer sent, awaiting response</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
            {offer.status === 'DRAFT' && (
              <>
                <Button variant="outline" onClick={() => setIsCreateModalOpen(true)}>
                  Edit offer
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSubmitForApproval}
                  loading={submittingForApproval}
                >
                  Submit for Approval
                </Button>
              </>
            )}
            {offer.status === 'APPROVED' && (
              <>
                <Button variant="outline" onClick={() => setIsCreateModalOpen(true)}>
                  Edit offer
                </Button>
                {isConfigured ? (
                  <Button onClick={() => setIsSignatureModalOpen(true)}>
                    <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                    Send for Signature
                  </Button>
                ) : (
                  <Button disabled title="Configure E-Sign to enable">
                    Send for Signature
                  </Button>
                )}
              </>
            )}
            {offer.status === 'SENT' && (
              <>
                <Button variant="outline" onClick={() => setIsSignatureModalOpen(true)}>
                  Resend
                </Button>
                <Button variant="outline" className="text-success-600 border-success-600 hover:bg-success-50">
                  Mark accepted
                </Button>
                <Button variant="outline" className="text-danger-600 border-danger-600 hover:bg-danger-50">
                  Mark declined
                </Button>
              </>
            )}
            {offer.status === 'ACCEPTED' && (
              <div className="flex items-center gap-2 text-success-600">
                <CheckCircleIcon className="h-5 w-5" />
                <p className="text-sm font-medium">
                  Offer accepted{offer.acceptedAt ? ` on ${new Date(offer.acceptedAt).toLocaleDateString()}` : ''}
                </p>
              </div>
            )}
            {offer.status === 'DECLINED' && (
              <div className="flex items-center gap-2 text-danger-600">
                <XCircleIcon className="h-5 w-5" />
                <p className="text-sm font-medium">Offer declined</p>
              </div>
            )}
          </div>

          {/* E-Sign not configured warning */}
          {!isConfigured && (offer.status === 'DRAFT' || offer.status === 'APPROVED') && (
            <div className="text-sm text-warning-600 bg-warning-50 px-3 py-2 rounded-lg">
              E-Sign not configured. Add ESIGN_API_KEY to enable e-signatures.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Offer Modal */}
      <CreateOfferModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        applicationId={applicationId}
        candidateName={candidateName}
        jobTitle={jobTitle}
        onOfferCreated={() => {
          setIsCreateModalOpen(false);
          onRefresh();
        }}
      />

      {/* Send for Signature Modal */}
      <Modal
        open={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        title="Send Offer for Signature"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-danger-50 text-danger-700 text-sm rounded-lg border border-danger-200">
              {error}
            </div>
          )}

          {/* Resend warning - shown when offer was already sent */}
          {offer?.status === 'SENT' && (
            <div className="p-3 bg-cyan-50 text-cyan-700 text-sm rounded-lg border border-cyan-200">
              <p className="font-medium">Resending offer</p>
              <p className="text-xs mt-1">A new signature request will be sent. The previous request will remain active until the candidate signs one of them.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Template
            </label>
            {templates.length > 0 ? (
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-500">
                No templates found. Create templates in the E-Sign admin panel first.
              </p>
            )}
          </div>

          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-3">
              <DocumentTextIcon className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-700 mb-1">Sending to:</p>
                <p>{candidateName}</p>
                <p className="text-xs text-gray-500 mt-2">
                  The candidate will receive an email with the offer letter to sign electronically.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={() => setIsSignatureModalOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSendForSignature}
            loading={sending}
            disabled={!selectedTemplate || templates.length === 0}
          >
            {sending ? 'Sending...' : 'Send for Signature'}
          </Button>
        </div>
      </Modal>

      {/* Reject Offer Modal */}
      <Modal
        open={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Offer"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-danger-50 text-danger-700 text-sm rounded-lg border border-danger-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason <span className="text-danger-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Please provide a reason for rejecting this offer..."
              rows={4}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be recorded and the offer will be returned to draft status.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={() => setIsRejectModalOpen(false)} disabled={rejecting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="bg-danger-600 hover:bg-danger-700"
            onClick={handleReject}
            loading={rejecting}
            disabled={!rejectReason.trim()}
          >
            {rejecting ? 'Rejecting...' : 'Reject Offer'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
