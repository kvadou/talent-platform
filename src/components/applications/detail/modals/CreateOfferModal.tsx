'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  onOfferCreated: () => void;
};

type CompensationType = 'HOURLY' | 'SALARY' | 'CONTRACT';
type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'TEMPORARY' | 'INTERNSHIP';

export function CreateOfferModal({
  isOpen,
  onClose,
  applicationId,
  candidateName,
  jobTitle,
  onOfferCreated,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    compensationType: 'HOURLY' as CompensationType,
    hourlyRate: '',
    salary: '',
    signOnBonus: '',
    startDate: '',
    employmentType: 'PART_TIME' as EmploymentType,
    notes: '',
  });

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (submitting) return;

    // Validate required fields
    const compensation =
      formData.compensationType === 'HOURLY'
        ? formData.hourlyRate
        : formData.salary;
    if (!compensation || !formData.startDate) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compensationType: formData.compensationType,
          hourlyRate:
            formData.compensationType === 'HOURLY'
              ? parseFloat(formData.hourlyRate)
              : null,
          salary:
            formData.compensationType !== 'HOURLY'
              ? parseFloat(formData.salary)
              : null,
          signOnBonus: formData.signOnBonus
            ? parseFloat(formData.signOnBonus)
            : null,
          startDate: formData.startDate,
          employmentType: formData.employmentType,
          notes: formData.notes || null,
        }),
      });

      if (res.ok) {
        onOfferCreated();
        onClose();
        setFormData({
          compensationType: 'HOURLY',
          hourlyRate: '',
          salary: '',
          signOnBonus: '',
          startDate: '',
          employmentType: 'PART_TIME',
          notes: '',
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (!submitting) {
      onClose();
    }
  }

  const isHourly = formData.compensationType === 'HOURLY';
  const canSubmit =
    (isHourly ? formData.hourlyRate : formData.salary) && formData.startDate;

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
              <Dialog.Panel className="w-full max-w-lg transform rounded-xl bg-white shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-success-100 flex items-center justify-center">
                      <DocumentTextIcon className="w-5 h-5 text-success-600" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-gray-900">
                        Create Offer
                      </Dialog.Title>
                      <p className="text-sm text-gray-500">
                        {candidateName} for {jobTitle}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                  {/* Compensation Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Compensation Type <span className="text-danger-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      {(['HOURLY', 'SALARY', 'CONTRACT'] as CompensationType[]).map((type) => (
                        <button
                          key={type}
                          onClick={() => updateField('compensationType', type)}
                          className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                            formData.compensationType === type
                              ? 'bg-brand-purple text-white border-brand-purple'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {type.charAt(0) + type.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Compensation Amount */}
                  <div className="grid grid-cols-2 gap-4">
                    {isHourly ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Hourly Rate <span className="text-danger-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                            $
                          </span>
                          <input
                            type="number"
                            value={formData.hourlyRate}
                            onChange={(e) => updateField('hourlyRate', e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                            /hr
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {formData.compensationType === 'CONTRACT' ? 'Contract Value' : 'Annual Salary'}{' '}
                          <span className="text-danger-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                            $
                          </span>
                          <input
                            type="number"
                            value={formData.salary}
                            onChange={(e) => updateField('salary', e.target.value)}
                            placeholder="0.00"
                            step="1000"
                            min="0"
                            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sign-On Bonus
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                          $
                        </span>
                        <input
                          type="number"
                          value={formData.signOnBonus}
                          onChange={(e) => updateField('signOnBonus', e.target.value)}
                          placeholder="0.00"
                          step="100"
                          min="0"
                          className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Employment Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date <span className="text-danger-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => updateField('startDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Employment Type
                      </label>
                      <select
                        value={formData.employmentType}
                        onChange={(e) => updateField('employmentType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
                      >
                        <option value="FULL_TIME">Full-time</option>
                        <option value="PART_TIME">Part-time</option>
                        <option value="CONTRACT">Contract</option>
                        <option value="TEMPORARY">Temporary</option>
                        <option value="INTERNSHIP">Internship</option>
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Internal Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => updateField('notes', e.target.value)}
                      placeholder="Add any internal notes about this offer..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
                      rows={3}
                    />
                  </div>

                  {/* Info Box */}
                  <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                    <p className="text-sm text-cyan-800">
                      After creating the offer, you can send it to the candidate via email and
                      track their acceptance through the candidate portal.
                    </p>
                  </div>
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
                    onClick={handleSubmit}
                    disabled={!canSubmit || submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-brand-purple hover:bg-brand-purple/90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Creating...' : 'Create Offer'}
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
