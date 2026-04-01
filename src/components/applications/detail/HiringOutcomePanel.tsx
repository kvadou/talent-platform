'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  CheckCircleIcon,
  XCircleIcon,
  StarIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

type OutcomeData = {
  id: string;
  applicationId: string;
  wasHired: boolean;
  hireDate: string | null;
  startDate: string | null;
  stillEmployedAt30Days: boolean | null;
  stillEmployedAt90Days: boolean | null;
  stillEmployedAt180Days: boolean | null;
  terminatedAt: string | null;
  terminationReason: string | null;
  performanceRating: number | null;
  performanceNotes: string | null;
  rejectionRegret: boolean;
  regretNotes: string | null;
};

type Props = {
  applicationId: string;
  status: string;
};

const TERMINATION_REASONS = [
  { value: '', label: 'Select reason...' },
  { value: 'VOLUNTARY', label: 'Voluntary resignation' },
  { value: 'PERFORMANCE', label: 'Performance issues' },
  { value: 'NO_SHOW', label: 'No show' },
  { value: 'ATTENDANCE', label: 'Attendance issues' },
  { value: 'OTHER', label: 'Other' },
];

type RetentionValue = 'yes' | 'no' | 'not_yet';

function retentionToApi(val: RetentionValue): boolean | null {
  if (val === 'yes') return true;
  if (val === 'no') return false;
  return null;
}

function apiToRetention(val: boolean | null): RetentionValue {
  if (val === true) return 'yes';
  if (val === false) return 'no';
  return 'not_yet';
}

function formatDateForInput(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().split('T')[0];
}

function dateInputToISO(dateStr: string): string | null {
  if (!dateStr) return null;
  return new Date(dateStr + 'T00:00:00.000Z').toISOString();
}

// Star rating component
function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= (hovered || value);
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onMouseEnter={() => !disabled && setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => !disabled && onChange(star)}
            className={`transition-colors ${
              disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110'
            } transition-transform`}
          >
            {isFilled ? (
              <StarIconSolid className="w-6 h-6 text-yellow-400" />
            ) : (
              <StarIcon className="w-6 h-6 text-gray-300" />
            )}
          </button>
        );
      })}
      {value > 0 && (
        <span className="ml-2 text-sm text-gray-500">{value}/5</span>
      )}
    </div>
  );
}

// Retention toggle component
function RetentionToggle({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: RetentionValue;
  onChange: (val: RetentionValue) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span>
      <div className="flex items-center gap-1.5">
        {(['yes', 'no', 'not_yet'] as RetentionValue[]).map((opt) => {
          const labels: Record<RetentionValue, string> = {
            yes: 'Yes',
            no: 'No',
            not_yet: 'Not yet',
          };
          const isSelected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onChange(opt)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                isSelected
                  ? opt === 'yes'
                    ? 'bg-success-50 text-success-700 border-success-300'
                    : opt === 'no'
                    ? 'bg-danger-50 text-danger-700 border-danger-300'
                    : 'bg-gray-100 text-gray-600 border-gray-300'
                  : disabled
                  ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-default'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {labels[opt]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function HiringOutcomePanel({ applicationId, status }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<OutcomeData | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create form
  const [wasHired, setWasHired] = useState(status === 'HIRED');
  const [hireDate, setHireDate] = useState('');
  const [startDate, setStartDate] = useState('');

  // Retention form
  const [retention30, setRetention30] = useState<RetentionValue>('not_yet');
  const [retention90, setRetention90] = useState<RetentionValue>('not_yet');
  const [retention180, setRetention180] = useState<RetentionValue>('not_yet');

  // Termination form
  const [terminatedAt, setTerminatedAt] = useState('');
  const [terminationReason, setTerminationReason] = useState('');

  // Performance form
  const [performanceRating, setPerformanceRating] = useState(0);
  const [performanceNotes, setPerformanceNotes] = useState('');

  // Rejection regret form
  const [rejectionRegret, setRejectionRegret] = useState(false);
  const [regretNotes, setRegretNotes] = useState('');

  const clearMessage = useCallback(() => {
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (message) {
      const cleanup = clearMessage();
      return cleanup;
    }
  }, [message, clearMessage]);

  // Fetch existing outcome
  useEffect(() => {
    async function fetchOutcome() {
      try {
        const res = await fetch(`/api/applications/${applicationId}/outcome`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.outcome) {
          setOutcome(data.outcome);
          // Populate edit fields from existing outcome
          setWasHired(data.outcome.wasHired);
          setHireDate(formatDateForInput(data.outcome.hireDate));
          setStartDate(formatDateForInput(data.outcome.startDate));
          setRetention30(apiToRetention(data.outcome.stillEmployedAt30Days));
          setRetention90(apiToRetention(data.outcome.stillEmployedAt90Days));
          setRetention180(apiToRetention(data.outcome.stillEmployedAt180Days));
          setTerminatedAt(formatDateForInput(data.outcome.terminatedAt));
          setTerminationReason(data.outcome.terminationReason || '');
          setPerformanceRating(data.outcome.performanceRating || 0);
          setPerformanceNotes(data.outcome.performanceNotes || '');
          setRejectionRegret(data.outcome.rejectionRegret || false);
          setRegretNotes(data.outcome.regretNotes || '');
        }
      } catch {
        // Silently fail on fetch - will show create form
      } finally {
        setLoading(false);
      }
    }
    fetchOutcome();
  }, [applicationId]);

  // Create initial outcome
  async function handleCreateOutcome() {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        wasHired,
      };
      if (wasHired) {
        if (hireDate) body.hireDate = dateInputToISO(hireDate);
        if (startDate) body.startDate = dateInputToISO(startDate);
      }
      if (!wasHired) {
        body.rejectionRegret = rejectionRegret;
        if (regretNotes) body.regretNotes = regretNotes;
      }

      const res = await fetch(`/api/applications/${applicationId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create outcome');
      }

      const data = await res.json();
      setOutcome(data.outcome);
      setMessage({ type: 'success', text: 'Outcome recorded successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  // Update existing outcome (PATCH)
  async function handleUpdateOutcome(fields: Record<string, unknown>) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/outcome`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update outcome');
      }

      const data = await res.json();
      setOutcome(data.outcome);
      setMessage({ type: 'success', text: 'Updated successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  // Save retention changes
  function handleSaveRetention() {
    handleUpdateOutcome({
      stillEmployedAt30Days: retentionToApi(retention30),
      stillEmployedAt90Days: retentionToApi(retention90),
      stillEmployedAt180Days: retentionToApi(retention180),
    });
  }

  // Save termination changes
  function handleSaveTermination() {
    handleUpdateOutcome({
      terminatedAt: terminatedAt ? dateInputToISO(terminatedAt) : null,
      terminationReason: terminationReason || null,
    });
  }

  // Save performance changes
  function handleSavePerformance() {
    handleUpdateOutcome({
      performanceRating: performanceRating || null,
      performanceNotes: performanceNotes || null,
    });
  }

  // Save regret changes
  function handleSaveRegret() {
    handleUpdateOutcome({
      rejectionRegret,
      regretNotes: regretNotes || null,
    });
  }

  if (loading) {
    return (
      <div className="mt-6">
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  // ---- CREATE FORM (no outcome exists yet) ----
  if (!outcome) {
    return (
      <div className="mt-6">
        <Card hover={false}>
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <ClipboardDocumentCheckIcon className="w-5 h-5 text-purple-500" />
                <span>Record Hiring Outcome</span>
              </div>
            }
            subtitle="Track the final result of this application"
            accent="purple"
          />
          <CardContent>
            <div className="space-y-5">
              {/* Was Hired Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Was this candidate hired?
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWasHired(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      wasHired
                        ? 'bg-success-50 text-success-700 border-success-300 shadow-sm'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <CheckCircleIcon className="w-4 h-4" />
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setWasHired(false)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      !wasHired
                        ? 'bg-danger-50 text-danger-700 border-danger-300 shadow-sm'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <XCircleIcon className="w-4 h-4" />
                    No
                  </button>
                </div>
              </div>

              {/* Hire/Start Dates (only if hired) */}
              {wasHired && (
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Hire Date"
                    type="date"
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                  />
                  <Input
                    label="Start Date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              )}

              {/* Rejection Regret (only if not hired) */}
              {!wasHired && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="rejection-regret-create"
                      checked={rejectionRegret}
                      onChange={(e) => setRejectionRegret(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <label
                      htmlFor="rejection-regret-create"
                      className="text-sm font-medium text-gray-700"
                    >
                      We regret passing on this candidate
                    </label>
                  </div>
                  {rejectionRegret && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Regret Notes
                      </label>
                      <textarea
                        value={regretNotes}
                        onChange={(e) => setRegretNotes(e.target.value)}
                        rows={3}
                        placeholder="Why do we regret this decision?"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 focus:border-brand-purple focus:ring-3 focus:ring-brand-purple/10 focus:outline-none placeholder:text-gray-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Feedback Message */}
              {message && (
                <div
                  className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                    message.type === 'success'
                      ? 'bg-success-50 text-success-700'
                      : 'bg-danger-50 text-danger-700'
                  }`}
                >
                  {message.type === 'success' ? (
                    <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                  )}
                  {message.text}
                </div>
              )}

              {/* Submit */}
              <div className="flex justify-end">
                <Button onClick={handleCreateOutcome} loading={saving} size="sm">
                  Record Outcome
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- EXISTING OUTCOME VIEW ----
  return (
    <div className="mt-6">
      <Card hover={false}>
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <ClipboardDocumentCheckIcon className="w-5 h-5 text-purple-500" />
              <span>Hiring Outcome</span>
            </div>
          }
          action={
            <Badge variant={outcome.wasHired ? 'success' : 'error'} dot>
              {outcome.wasHired ? 'Hired' : 'Not Hired'}
            </Badge>
          }
          accent="purple"
        />
        <CardContent>
          <div className="space-y-6">
            {/* Core Details */}
            {outcome.wasHired && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Hire Date
                  </span>
                  <span className="text-sm text-gray-900">
                    {outcome.hireDate
                      ? new Date(outcome.hireDate).toLocaleDateString()
                      : 'Not set'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Start Date
                  </span>
                  <span className="text-sm text-gray-900">
                    {outcome.startDate
                      ? new Date(outcome.startDate).toLocaleDateString()
                      : 'Not set'}
                  </span>
                </div>
              </div>
            )}

            {/* Retention Tracking (only for hires) */}
            {outcome.wasHired && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Retention Tracking</h4>
                <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                  <RetentionToggle
                    label="Still employed at 30 days"
                    value={retention30}
                    onChange={setRetention30}
                  />
                  <RetentionToggle
                    label="Still employed at 90 days"
                    value={retention90}
                    onChange={setRetention90}
                    disabled={retention30 === 'not_yet'}
                  />
                  <RetentionToggle
                    label="Still employed at 180 days"
                    value={retention180}
                    onChange={setRetention180}
                    disabled={retention90 === 'not_yet' || retention30 === 'not_yet'}
                  />
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSaveRetention}
                      loading={saving}
                      size="xs"
                      variant="secondary"
                    >
                      Save Retention
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Termination Section (only for hires) */}
            {outcome.wasHired && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Termination</h4>
                <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                  <Input
                    label="Termination Date"
                    type="date"
                    value={terminatedAt}
                    onChange={(e) => setTerminatedAt(e.target.value)}
                  />
                  <Select
                    label="Reason"
                    value={terminationReason}
                    onChange={(e) => setTerminationReason(e.target.value)}
                  >
                    {TERMINATION_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSaveTermination}
                      loading={saving}
                      size="xs"
                      variant="secondary"
                    >
                      Save Termination
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Performance Section (only for hires) */}
            {outcome.wasHired && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Performance</h4>
                <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                    <StarRating
                      value={performanceRating}
                      onChange={setPerformanceRating}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                    <textarea
                      value={performanceNotes}
                      onChange={(e) => setPerformanceNotes(e.target.value)}
                      rows={3}
                      placeholder="How is this hire performing?"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 focus:border-brand-purple focus:ring-3 focus:ring-brand-purple/10 focus:outline-none placeholder:text-gray-500"
                    />
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSavePerformance}
                      loading={saving}
                      size="xs"
                      variant="secondary"
                    >
                      Save Performance
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Rejection Regret (only for non-hires) */}
            {!outcome.wasHired && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Rejection Regret</h4>
                <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="rejection-regret-edit"
                      checked={rejectionRegret}
                      onChange={(e) => setRejectionRegret(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <label
                      htmlFor="rejection-regret-edit"
                      className="text-sm font-medium text-gray-700"
                    >
                      We regret passing on this candidate
                    </label>
                  </div>
                  {rejectionRegret && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Regret Notes
                      </label>
                      <textarea
                        value={regretNotes}
                        onChange={(e) => setRegretNotes(e.target.value)}
                        rows={3}
                        placeholder="Why do we regret this decision?"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 focus:border-brand-purple focus:ring-3 focus:ring-brand-purple/10 focus:outline-none placeholder:text-gray-500"
                      />
                    </div>
                  )}
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSaveRegret}
                      loading={saving}
                      size="xs"
                      variant="secondary"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Feedback Message */}
            {message && (
              <div
                className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                  message.type === 'success'
                    ? 'bg-success-50 text-success-700'
                    : 'bg-danger-50 text-danger-700'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                )}
                {message.text}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
