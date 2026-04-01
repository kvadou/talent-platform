'use client';

import { useState, useEffect } from 'react';
import { ApplicationHeader } from './ApplicationHeader';
import { ApplicationLeftNav } from './ApplicationLeftNav';
import { ApplicationRightSidebar } from './ApplicationRightSidebar';
import { StagesView } from './views/StagesView';
import { ScorecardsView } from './views/ScorecardsView';
import { OfferDetailsView } from './views/OfferDetailsView';
import { ActivityFeedView } from './views/ActivityFeedView';
import { MobileBottomNav } from './MobileBottomNav';

export type LeftNavItem = 'stages' | 'scorecards' | 'offer' | 'activity';
export type RightPanelItem = 'candidate' | 'application' | 'jobs' | 'notes' | 'tasks' | 'portal';

export type ApplicationData = {
  id: string;
  status: string;
  source: string | null;
  createdAt: string;
  job: {
    id: string;
    title: string;
    market: { id: string; name: string };
    esignTemplateId: string | null;
    stages: Array<{
      id: string;
      name: string;
      order: number;
      stageRules: Array<{
        id: string;
        trigger: string;
        actionType: string;
        isActive: boolean;
      }>;
    }>;
  };
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    resumeUrl: string | null;
    linkedinUrl: string | null;
    portfolioUrl: string | null;
    street: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postcode: string | null;
    timezone: string | null;
    tags: string[];
    applications: Array<{
      id: string;
      status: string;
      createdAt: string;
      job: { id: string; title: string; market: { name: string } };
      stage: { name: string };
    }>;
  };
  stage: {
    id: string;
    name: string;
    order: number;
  };
  stageHistory: Array<{
    id: string;
    stageId: string;
    movedAt: string;
    movedBy: string | null;
    stage: { id: string; name: string; order: number };
  }>;
  interviews: Array<{
    id: string;
    scheduledAt: string;
    duration: number;
    type: string;
    location: string | null;
    meetingLink: string | null;
    notes: string | null;
    interviewer: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    feedback: Array<{
      id: string;
      recommendation: string | null;
      strengths: string | null;
      weaknesses: string | null;
      notes: string | null;
      submittedAt: string | null;
    }>;
    kitScorecards: Array<{
      id: string;
      overallRecommendation: string;
      submittedAt: string | null;
    }>;
  }>;
  notes: Array<{
    id: string;
    content: string;
    isPrivate: boolean;
    createdAt: string;
    author: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueAt: string | null;
    completedAt: string | null;
    assignee: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
  offer: {
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
  } | null;
  answers: Array<{
    id: string;
    value: string;
    question: {
      id: string;
      label: string;
      type: string;
    };
  }>;
  portalTokens: Array<{
    token: string;
  }>;
  messages: Array<{
    id: string;
    type: string;
    recipient: string;
    subject: string | null;
    body: string | null;
    sentAt: string;
    status: string;
  }>;
  aiScore: number | null;
  aiScoreBreakdown: {
    resumeFit: number;
    answerCompleteness: number;
    answerQuality: number;
    overallScore: number;
    factors?: {
      hasResume: boolean;
      totalQuestions: number;
      answeredQuestions: number;
      avgAnswerLength: number;
    };
  } | null;
  aiScoredAt: string | null;
};

type Props = {
  application: ApplicationData;
  totalCandidates: number;
  currentIndex: number;
  prevApplicationId: string | null;
  nextApplicationId: string | null;
};

export function ApplicationDetailPage({
  application,
  totalCandidates,
  currentIndex,
  prevApplicationId,
  nextApplicationId,
}: Props) {
  const [activeLeftNav, setActiveLeftNav] = useState<LeftNavItem>('stages');
  const [activeRightPanel, setActiveRightPanel] = useState<RightPanelItem>('candidate');
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
  const [isMobileBottomSheetOpen, setIsMobileBottomSheetOpen] = useState(false);
  const [applicationData, setApplicationData] = useState<ApplicationData>(application);

  // Refresh application data
  const refreshData = async () => {
    try {
      const res = await fetch(`/api/applications/${application.id}/detail`);
      if (res.ok) {
        const data = await res.json();
        setApplicationData(data.application);
      }
    } catch (error) {
      console.error('Failed to refresh application data:', error);
    }
  };

  // Task badge count
  const pendingTasksCount = applicationData.tasks.filter(
    (t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS'
  ).length;

  // Render main content based on active left nav
  const renderMainContent = () => {
    switch (activeLeftNav) {
      case 'stages':
        return (
          <StagesView
            application={applicationData}
            onRefresh={refreshData}
            onNavigateToOffer={() => setActiveLeftNav('offer')}
            offer={applicationData.offer}
          />
        );
      case 'scorecards':
        return (
          <ScorecardsView
            interviews={applicationData.interviews}
            onRefresh={refreshData}
          />
        );
      case 'offer':
        return (
          <OfferDetailsView
            applicationId={applicationData.id}
            candidateId={applicationData.candidate.id}
            offer={applicationData.offer}
            candidateName={`${applicationData.candidate.firstName} ${applicationData.candidate.lastName}`}
            jobTitle={applicationData.job.title}
            defaultTemplateId={applicationData.job.esignTemplateId}
            onRefresh={refreshData}
          />
        );
      case 'activity':
        return (
          <ActivityFeedView
            applicationId={applicationData.id}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <ApplicationHeader
        application={applicationData}
        totalCandidates={totalCandidates}
        currentIndex={currentIndex}
        prevApplicationId={prevApplicationId}
        nextApplicationId={nextApplicationId}
        onRefresh={refreshData}
      />

      {/* Mobile Left Nav Tabs */}
      <div className="lg:hidden border-b border-gray-200 bg-white">
        <div className="flex overflow-x-auto px-4 py-2 gap-2 no-scrollbar">
          {(['stages', 'scorecards', 'offer', 'activity'] as LeftNavItem[]).map((item) => (
            <button
              key={item}
              onClick={() => setActiveLeftNav(item)}
              className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                activeLeftNav === item
                  ? 'bg-brand-purple text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation - Desktop only */}
        <div className="hidden lg:block w-52 flex-shrink-0 border-r border-gray-200 bg-white">
          <ApplicationLeftNav
            activeItem={activeLeftNav}
            onItemChange={setActiveLeftNav}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
          {renderMainContent()}
        </div>

        {/* Right Sidebar - Desktop */}
        <div
          className={`hidden lg:flex flex-col border-l border-gray-200 bg-white transition-all duration-300 ${
            isRightSidebarCollapsed ? 'w-14' : 'w-80'
          }`}
        >
          <ApplicationRightSidebar
            application={applicationData}
            activePanel={activeRightPanel}
            onPanelChange={setActiveRightPanel}
            isCollapsed={isRightSidebarCollapsed}
            onToggleCollapse={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
            pendingTasksCount={pendingTasksCount}
            onRefresh={refreshData}
          />
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        application={applicationData}
        activePanel={activeRightPanel}
        onPanelChange={(panel) => {
          setActiveRightPanel(panel);
          setIsMobileBottomSheetOpen(true);
        }}
        pendingTasksCount={pendingTasksCount}
        isBottomSheetOpen={isMobileBottomSheetOpen}
        onCloseBottomSheet={() => setIsMobileBottomSheetOpen(false)}
        onRefresh={refreshData}
      />
    </div>
  );
}
