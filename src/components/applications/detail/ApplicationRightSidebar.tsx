'use client';

import {
  UserIcon,
  DocumentTextIcon,
  BriefcaseIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  EyeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  pendingTasksCount: number;
  onRefresh: () => void;
};

const panelItems: { id: RightPanelItem; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: 'candidate', icon: UserIcon, label: 'Candidate details' },
  { id: 'application', icon: DocumentTextIcon, label: 'Application details' },
  { id: 'jobs', icon: BriefcaseIcon, label: 'All jobs & applications' },
  { id: 'notes', icon: ChatBubbleLeftRightIcon, label: 'Notes' },
  { id: 'tasks', icon: BellIcon, label: 'Tasks & reminders' },
  { id: 'portal', icon: EyeIcon, label: 'Candidate portal' },
];

export function ApplicationRightSidebar({
  application,
  activePanel,
  onPanelChange,
  isCollapsed,
  onToggleCollapse,
  pendingTasksCount,
  onRefresh,
}: Props) {
  const renderPanelContent = () => {
    if (isCollapsed) return null;

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
    <div className="flex h-full">
      {/* Icon Tabs */}
      <div className="w-14 flex flex-col items-center py-4 border-l border-gray-100 bg-gray-50">
        {/* Collapse Toggle */}
        <button
          onClick={onToggleCollapse}
          className="p-2 mb-4 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronLeftIcon className="w-5 h-5" />
          ) : (
            <ChevronRightIcon className="w-5 h-5" />
          )}
        </button>

        {/* Panel Icons */}
        {panelItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          const showBadge = item.id === 'tasks' && pendingTasksCount > 0;

          return (
            <button
              key={item.id}
              onClick={() => {
                onPanelChange(item.id);
                if (isCollapsed) onToggleCollapse();
              }}
              className={`relative p-2.5 mb-1 rounded-lg transition-colors ${
                isActive && !isCollapsed
                  ? 'bg-brand-purple text-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
              {showBadge && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
                  {pendingTasksCount > 9 ? '9+' : pendingTasksCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Panel Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto">
          {renderPanelContent()}
        </div>
      )}
    </div>
  );
}
