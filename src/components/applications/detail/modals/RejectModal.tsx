'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

type RejectionReason = {
  id: string;
  name: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  candidateName: string;
  onRejectComplete: () => void;
};

const DEFAULT_REJECTION_REASONS: RejectionReason[] = [
  { id: 'not_qualified', name: 'Not qualified for position' },
  { id: 'experience', name: 'Insufficient experience' },
  { id: 'skills', name: 'Missing required skills' },
  { id: 'culture_fit', name: 'Not a culture fit' },
  { id: 'timing', name: 'Position filled' },
  { id: 'salary', name: 'Salary expectations too high' },
  { id: 'location', name: 'Location requirements not met' },
  { id: 'availability', name: 'Availability issues' },
  { id: 'withdrew', name: 'Candidate withdrew' },
  { id: 'other', name: 'Other' },
];

export function RejectModal({
  isOpen,
  onClose,
  applicationId,
  candidateName,
  onRejectComplete,
}: Props) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function handleReject() {
    if (!selectedReason || submitting) return;

    const reason = selectedReason === 'other' ? customReason : selectedReason;
    if (selectedReason === 'other' && !customReason.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          sendEmail,
        }),
      });

      if (res.ok) {
        onRejectComplete();
        onClose();
        setSelectedReason('');
        setCustomReason('');
        setSendEmail(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (!submitting) {
      onClose();
      setSelectedReason('');
      setCustomReason('');
      setSendEmail(true);
    }
  }

  const canSubmit =
    selectedReason && (selectedReason !== 'other' || customReason.trim());

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform rounded-xl bg-white shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-danger-100 flex items-center justify-center">
                      <ExclamationTriangleIcon className="w-5 h-5 text-danger-600" />
                    </div>
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      Reject Candidate
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Are you sure you want to reject <span className="font-medium">{candidateName}</span>?
                    This action will update the application status to rejected.
                  </p>

                  {/* Rejection Reason */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rejection Reason <span className="text-danger-500">*</span>
                    </label>
                    <select
                      value={selectedReason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
                    >
                      <option value="">Select a reason...</option>
                      {DEFAULT_REJECTION_REASONS.map((reason) => (
                        <option key={reason.id} value={reason.id}>
                          {reason.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom Reason */}
                  {selectedReason === 'other' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Please specify <span className="text-danger-500">*</span>
                      </label>
                      <textarea
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="Enter rejection reason..."
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
                        rows={3}
                      />
                    </div>
                  )}

                  {/* Send Email Toggle */}
                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Send rejection email</p>
                      <p className="text-xs text-gray-500">
                        Notify the candidate about their application status
                      </p>
                    </div>
                  </label>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!canSubmit || submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-danger-600 hover:bg-danger-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Rejecting...' : 'Reject Candidate'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
