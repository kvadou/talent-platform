'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  UserIcon,
  DocumentTextIcon,
  BriefcaseIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  EyeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { CandidateDetailsPanel } from './panels/CandidateDetailsPanel';
import { ApplicationDetailsPanel } from './panels/ApplicationDetailsPanel';
import { AllApplicationsPanel } from './panels/AllApplicationsPanel';
import { NotesPanel } from './panels/NotesPanel';
import { TasksPanel } from './panels/TasksPanel';
import { CandidatePortalPreview } from './panels/CandidatePortalPreview';
import type { ApplicationData, RightPanelItem } from './ApplicationDetailPage';

type Props = {
  application: ApplicationData;
  activePanel: RightPanelItem;
  onPanelChange: (panel: RightPanelItem) => void;
  pendingTasksCount: number;
  isBottomSheetOpen: boolean;
  onCloseBottomSheet: () => void;
  onRefresh: () => void;
};

const panelItems: { id: RightPanelItem; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: 'candidate', icon: UserIcon, label: 'Details' },
  { id: 'application', icon: DocumentTextIcon, label: 'Application' },
  { id: 'jobs', icon: BriefcaseIcon, label: 'Jobs' },
  { id: 'notes', icon: ChatBubbleLeftRightIcon, label: 'Notes' },
  { id: 'tasks', icon: BellIcon, label: 'Tasks' },
  { id: 'portal', icon: EyeIcon, label: 'Portal' },
];

export function MobileBottomNav({
  application,
  activePanel,
  onPanelChange,
  pendingTasksCount,
  isBottomSheetOpen,
  onCloseBottomSheet,
  onRefresh,
}: Props) {
  const getPanelTitle = () => {
    const item = panelItems.find((p) => p.id === activePanel);
    return item?.label || '';
  };

  const renderPanelContent = () => {
    switch (activePanel) {
      case 'candidate':
        return <CandidateDetailsPanel candidate={application.candidate} onTimezoneUpdate={async (tz) => {
          try {
            await fetch(`/api/candidates/${application.candidate.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'update-timezone', timezone: tz }),
            });
          } catch { /* silent */ }
        }} />;
      case 'application':
        return (
          <ApplicationDetailsPanel
            application={application}
            answers={application.answers}
          />
        );
      case 'jobs':
        return (
          <AllApplicationsPanel
            currentApplicationId={application.id}
            applications={application.candidate.applications}
          />
        );
      case 'notes':
        return (
          <NotesPanel
            applicationId={application.id}
            candidateId={application.candidate.id}
            notes={application.notes}
            onRefresh={onRefresh}
          />
        );
      case 'tasks':
        return (
          <TasksPanel
            applicationId={application.id}
            candidateId={application.candidate.id}
            onRefresh={onRefresh}
          />
        );
      case 'portal':
        return (
          <CandidatePortalPreview
            candidateId={application.candidate.id}
            applicationId={application.id}
            portalToken={application.portalTokens?.[0]?.token}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-1 py-1.5 safe-area-bottom">
        <div className="flex items-center justify-around">
          {panelItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePanel === item.id && isBottomSheetOpen;
            const showBadge = item.id === 'tasks' && pendingTasksCount > 0;

            return (
              <button
                key={item.id}
                onClick={() => onPanelChange(item.id)}
                className={`relative flex flex-col items-center justify-center min-w-[52px] min-h-[48px] py-2 px-2 rounded-xl transition-colors active:bg-gray-100 ${
                  isActive
                    ? 'text-brand-purple bg-purple-50'
                    : 'text-gray-500'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-[10px] mt-1 font-medium leading-tight">{item.label}</span>
                {showBadge && (
                  <span className="absolute -top-0.5 right-0.5 min-w-[18px] h-[18px] bg-danger-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {pendingTasksCount > 9 ? '9+' : pendingTasksCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Sheet */}
      <Transition show={isBottomSheetOpen} as={Fragment}>
        <Dialog onClose={onCloseBottomSheet} className="relative z-50 lg:hidden">
          {/* Backdrop */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          </Transition.Child>

          {/* Bottom Sheet Panel */}
          <div className="fixed inset-x-0 bottom-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="translate-y-full"
              enterTo="translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="translate-y-0"
              leaveTo="translate-y-full"
            >
              <Dialog.Panel className="w-full bg-white rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col">
                {/* Handle */}
                <div className="flex justify-center py-2">
                  <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    {getPanelTitle()}
                  </Dialog.Title>
                  <button
                    onClick={onCloseBottomSheet}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto pb-20">
                  {renderPanelContent()}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
