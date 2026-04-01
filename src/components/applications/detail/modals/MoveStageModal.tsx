'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, BoltIcon, EnvelopeIcon, CheckIcon } from '@heroicons/react/24/outline';

type Stage = {
  id: string;
  name: string;
  order: number;
  stageRules?: {
    id: string;
    trigger: string;
    actionType: string;
    isActive: boolean;
  }[];
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  currentStageId: string;
  stages: Stage[];
  onMoveComplete: () => void;
};

export function MoveStageModal({
  isOpen,
  onClose,
  applicationId,
  currentStageId,
  stages,
  onMoveComplete,
}: Props) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [skipAutomation, setSkipAutomation] = useState(false);

  const currentStage = stages.find((s) => s.id === currentStageId);
  const selectedStage = stages.find((s) => s.id === selectedStageId);
  const hasAutomation = selectedStage?.stageRules && selectedStage.stageRules.length > 0;

  async function handleMove() {
    if (!selectedStageId || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/move-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageId: selectedStageId,
          skipAutomation,
        }),
      });

      if (res.ok) {
        onMoveComplete();
        onClose();
        setSelectedStageId(null);
        setSkipAutomation(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (!submitting) {
      onClose();
      setSelectedStageId(null);
      setSkipAutomation(false);
    }
  }

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
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    Move to Stage
                  </Dialog.Title>
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
                    Current stage: <span className="font-medium">{currentStage?.name || 'Unknown'}</span>
                  </p>

                  {/* Stage Selection */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {stages.map((stage) => {
                      const isCurrentStage = stage.id === currentStageId;
                      const isSelected = stage.id === selectedStageId;
                      const stageHasAutomation = stage.stageRules && stage.stageRules.length > 0;

                      return (
                        <button
                          key={stage.id}
                          onClick={() => !isCurrentStage && setSelectedStageId(stage.id)}
                          disabled={isCurrentStage}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            isCurrentStage
                              ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
                              : isSelected
                              ? 'bg-brand-purple/5 border-brand-purple'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                  isSelected
                                    ? 'border-brand-purple bg-brand-purple'
                                    : 'border-gray-300'
                                }`}
                              >
                                {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                              </div>
                              <span
                                className={`text-sm font-medium ${
                                  isCurrentStage ? 'text-gray-400' : 'text-gray-900'
                                }`}
                              >
                                {stage.name}
                              </span>
                              {isCurrentStage && (
                                <span className="text-xs text-gray-400">(current)</span>
                              )}
                            </div>
                            {stageHasAutomation && !isCurrentStage && (
                              <div className="flex items-center gap-1 text-warning-600">
                                <BoltIcon className="w-4 h-4" />
                                <span className="text-xs font-medium">
                                  {stage.stageRules?.length} automation{stage.stageRules?.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Automation Preview */}
                  {hasAutomation && selectedStage && (
                    <div className="mt-4 p-3 bg-warning-50 border border-warning-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <BoltIcon className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-warning-800">
                            Automation will trigger
                          </p>
                          <div className="mt-2 space-y-2">
                            {selectedStage.stageRules?.filter(r => r.isActive).map((rule) => (
                              <div key={rule.id} className="flex items-center gap-2 text-sm text-warning-700">
                                <EnvelopeIcon className="w-4 h-4" />
                                <span>
                                  {rule.trigger === 'onEnter' ? 'On enter' : 'On exit'}: {rule.actionType.replace(/_/g, ' ').toLowerCase()}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Skip automation toggle */}
                          <label className="flex items-center gap-2 mt-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={skipAutomation}
                              onChange={(e) => setSkipAutomation(e.target.checked)}
                              className="w-4 h-4 rounded border-warning-300 text-warning-600 focus:ring-amber-500"
                            />
                            <span className="text-sm text-warning-700">Skip automation this time</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
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
                    onClick={handleMove}
                    disabled={!selectedStageId || submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-brand-purple hover:bg-brand-purple/90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Moving...' : 'Move Stage'}
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
