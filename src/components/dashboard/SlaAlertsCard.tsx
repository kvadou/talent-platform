'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { BulkEmailModal } from '@/components/email/BulkEmailModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { AlertModal } from '@/components/ui/AlertModal';
import {
  ExclamationTriangleIcon,
  ClockIcon,
  EnvelopeIcon,
  ArrowRightIcon,
  XMarkIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface StuckCandidate {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobId: string;
  jobTitle: string;
  daysInStage: number;
  enteredAt: string;
}

interface StageAlert {
  stageId: string;
  stageName: string;
  stageOrder: number;
  slaTargetDays: number;
  candidates: StuckCandidate[];
}

interface SlaAlertsData {
  summary: {
    totalStuck: number;
    stagesWithBreaches: number;
    longestWait: number;
  };
  alertsByStage: StageAlert[];
}

export function SlaAlertsCard() {
  const [data, setData] = useState<SlaAlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [selectedApplications, setSelectedApplications] = useState<Set<string>>(new Set());
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  async function fetchAlerts() {
    try {
      const res = await fetch('/api/dashboard/sla-alerts');
      if (res.ok) {
        const alertData = await res.json();
        setData(alertData);
        // Auto-expand first stage with breaches
        if (alertData.alertsByStage.length > 0) {
          setExpandedStages(new Set([alertData.alertsByStage[0].stageId]));
        }
      }
    } catch (err) {
      console.error('Failed to fetch SLA alerts:', err);
    } finally {
      setLoading(false);
    }
  }

  function toggleStage(stageId: string) {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  }

  function toggleCandidate(applicationId: string) {
    setSelectedApplications((prev) => {
      const next = new Set(prev);
      if (next.has(applicationId)) {
        next.delete(applicationId);
      } else {
        next.add(applicationId);
      }
      return next;
    });
  }

  function selectAllInStage(stageId: string) {
    const stage = data?.alertsByStage.find((s) => s.stageId === stageId);
    if (!stage) return;

    setSelectedApplications((prev) => {
      const next = new Set(prev);
      const allSelected = stage.candidates.every((c) => next.has(c.applicationId));

      if (allSelected) {
        // Deselect all
        stage.candidates.forEach((c) => next.delete(c.applicationId));
      } else {
        // Select all
        stage.candidates.forEach((c) => next.add(c.applicationId));
      }
      return next;
    });
  }

  function getSelectedRecipients() {
    if (!data) return [];
    const recipients: Array<{ id: string; name: string; email: string; jobTitle?: string }> = [];

    for (const stage of data.alertsByStage) {
      for (const candidate of stage.candidates) {
        if (selectedApplications.has(candidate.applicationId)) {
          recipients.push({
            id: candidate.applicationId,
            name: candidate.candidateName,
            email: candidate.candidateEmail,
            jobTitle: candidate.jobTitle,
          });
        }
      }
    }
    return recipients;
  }

  async function handleBulkEmail(emailData: { subject: string; body: string; recipientIds: string[]; fromAddress?: string; cc?: string[]; attachments?: Array<{ name: string; type: string; size: number; content: string }> }) {
    try {
      const res = await fetch('/api/email/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationIds: emailData.recipientIds,
          subject: emailData.subject,
          body: emailData.body,
          fromAddress: emailData.fromAddress,
          cc: emailData.cc,
          attachments: emailData.attachments,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to send emails');
      }

      setSelectedApplications(new Set());
      setShowEmailModal(false);
    } catch (err) {
      console.error('Bulk email failed:', err);
      throw err;
    }
  }

  async function handleBulkReject() {
    setShowRejectConfirm(false);
    setActionLoading(true);
    try {
      const promises = Array.from(selectedApplications).map((appId) =>
        fetch(`/api/applications/${appId}/reject`, { method: 'POST' })
      );
      await Promise.all(promises);
      setSelectedApplications(new Set());
      fetchAlerts(); // Refresh data
    } catch (err) {
      console.error('Bulk reject failed:', err);
      setAlertMsg('Failed to reject some candidates. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <Card variant="elevated">
        <CardContent className="py-8">
          <div className="animate-pulse flex items-center justify-center">
            <div className="h-4 w-32 bg-slate-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.summary.totalStuck === 0) {
    return null; // Don't show card if no alerts
  }

  return (
    <>
      <Card variant="elevated" className="border-l-4 border-l-orange-500">
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-warning-500" />
              Attention Required
            </div>
          }
          accent="yellow"
          action={
            <Badge variant="warning" size="sm">
              {data.summary.totalStuck} stuck
            </Badge>
          }
        />
        <CardContent noPadding>
          <div className="px-6 py-3 bg-warning-50 border-b border-warning-100">
            <p className="text-sm text-warning-800">
              <strong>{data.summary.totalStuck} candidates</strong> have exceeded their stage SLA.
              Longest wait: <strong>{data.summary.longestWait} days</strong>.
            </p>
          </div>

          {/* Bulk Action Bar */}
          {selectedApplications.size > 0 && (
            <div className="px-6 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
              <span className="text-sm font-medium text-purple-900">
                {selectedApplications.size} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowEmailModal(true)}
                  disabled={actionLoading}
                >
                  <EnvelopeIcon className="w-4 h-4 mr-1" />
                  Email
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRejectConfirm(true)}
                  disabled={actionLoading}
                  className="text-danger-600 border-danger-200 hover:bg-danger-50"
                >
                  <XMarkIcon className="w-4 h-4 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedApplications(new Set())}
                  disabled={actionLoading}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Stage Groups */}
          <div className="divide-y divide-slate-100">
            {data.alertsByStage.map((stage) => {
              const isExpanded = expandedStages.has(stage.stageId);
              const allSelected = stage.candidates.every((c) =>
                selectedApplications.has(c.applicationId)
              );
              const someSelected = stage.candidates.some((c) =>
                selectedApplications.has(c.applicationId)
              );

              return (
                <div key={stage.stageId}>
                  {/* Stage Header */}
                  <button
                    onClick={() => toggleStage(stage.stageId)}
                    className="w-full px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAllInStage(stage.stageId);
                        }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                          allSelected
                            ? 'bg-purple-600 border-purple-600'
                            : someSelected
                              ? 'border-purple-400 bg-purple-100'
                              : 'border-slate-300 hover:border-purple-400'
                        }`}
                      >
                        {allSelected && <CheckIcon className="w-3 h-3 text-white" />}
                        {someSelected && !allSelected && (
                          <div className="w-2 h-2 bg-purple-600 rounded-sm" />
                        )}
                      </div>
                      <span className="font-semibold text-navy-900">{stage.stageName}</span>
                      <Badge variant="warning" size="sm">
                        {stage.candidates.length} &gt; {stage.slaTargetDays}d
                      </Badge>
                    </div>
                    {isExpanded ? (
                      <ChevronUpIcon className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                    )}
                  </button>

                  {/* Candidates List */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-100">
                      {stage.candidates.map((candidate) => {
                        const isSelected = selectedApplications.has(candidate.applicationId);
                        return (
                          <div
                            key={candidate.applicationId}
                            className={`px-6 py-3 flex items-center gap-3 border-b border-slate-100 last:border-b-0 ${
                              isSelected ? 'bg-purple-50' : ''
                            }`}
                          >
                            <div
                              onClick={() => toggleCandidate(candidate.applicationId)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-purple-600 border-purple-600'
                                  : 'border-slate-300 hover:border-purple-400'
                              }`}
                            >
                              {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/applications/${candidate.applicationId}`}
                                  className="font-medium text-navy-900 hover:text-purple-700 truncate"
                                >
                                  {candidate.candidateName}
                                </Link>
                                <span className="text-slate-400">•</span>
                                <span className="text-sm text-slate-600 truncate">
                                  {candidate.jobTitle}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm">
                              <ClockIcon className="w-4 h-4 text-warning-500" />
                              <span className="font-medium text-warning-600">
                                {candidate.daysInStage}d
                              </span>
                            </div>

                            <Link href={`/applications/${candidate.applicationId}`}>
                              <Button variant="ghost" size="sm">
                                <ArrowRightIcon className="w-4 h-4" />
                              </Button>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Email Modal */}
      <BulkEmailModal
        open={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        recipients={getSelectedRecipients()}
        onSend={handleBulkEmail}
      />

      <ConfirmModal
        open={showRejectConfirm}
        onClose={() => setShowRejectConfirm(false)}
        onConfirm={handleBulkReject}
        title="Confirm Rejection"
        message={`Reject ${selectedApplications.size} candidates? This will mark them as rejected.`}
        confirmLabel="Reject"
        variant="danger"
      />

      <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} title="Error" message={alertMsg || ""} />
    </>
  );
}
