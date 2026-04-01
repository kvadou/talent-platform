'use client';

import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronRightIcon, BoltIcon, PlusIcon, BookOpenIcon, XMarkIcon, TrashIcon, DocumentTextIcon, HandThumbDownIcon, HandThumbUpIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import type { ApplicationData } from '../ApplicationDetailPage';
import { InterviewForm } from '@/components/interviews/InterviewForm';
import { HiringOutcomePanel } from '../HiringOutcomePanel';

type Props = {
  application: ApplicationData;
  onRefresh: () => void;
  onNavigateToOffer?: () => void;
  offer?: ApplicationData['offer'];
};

export function StagesView({ application, onRefresh, onNavigateToOffer, offer }: Props) {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(() => {
    // Expand current stage by default
    return new Set([application.stage.id]);
  });
  // When the current stage changes (e.g. after a move), expand only the new current stage
  useEffect(() => {
    setExpandedStages(new Set([application.stage.id]));
  }, [application.stage.id]);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [deleteInterview, setDeleteInterview] = useState<{ id: string; type: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteInterview() {
    if (!deleteInterview) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/interviews/${deleteInterview.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      onRefresh();
    } catch (err) {
      console.error('Failed to delete interview:', err);
    } finally {
      setDeleting(false);
      setDeleteInterview(null);
    }
  }

  const toggleStage = (stageId: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  };

  // Get stage history for a specific stage
  const getStageHistory = (stageId: string) => {
    return application.stageHistory.find((h) => h.stageId === stageId);
  };

  // Get interviews for a specific stage (based on when the candidate was in that stage)
  const getInterviewsForStage = (stageOrder: number) => {
    return application.interviews.filter((interview) => {
      // For simplicity, show all interviews in their scheduled stage
      // This could be enhanced with a stageId on interviews
      return true;
    });
  };

  // Check if stage has automation rules
  const hasAutomation = (stageId: string) => {
    const stage = application.job.stages.find((s) => s.id === stageId);
    return stage?.stageRules.some((r) => r.isActive) ?? false;
  };

  return (
    <div className="space-y-1">
      {application.job.stages
        .sort((a, b) => a.order - b.order)
        .map((stage, index) => {
          const isCurrentStage = stage.id === application.stage.id;
          const isExpanded = expandedStages.has(stage.id);
          const stageHistory = getStageHistory(stage.id);
          const hasAutomationRules = hasAutomation(stage.id);
          const isPastStage = stage.order < application.stage.order;
          const isFutureStage = stage.order > application.stage.order;

          // Get interviews for this stage
          const stageInterviews = application.interviews.filter((i) => {
            // Check if interview was scheduled while in this stage
            const interviewDate = new Date(i.scheduledAt);
            if (stageHistory) {
              return true; // Show all for now
            }
            return false;
          });

          return (
            <div
              key={stage.id}
              className={`border rounded-lg transition-colors ${
                isCurrentStage
                  ? 'border-brand-purple/30 bg-brand-purple/5'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {/* Stage Header */}
              <button
                onClick={() => toggleStage(stage.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                {/* Expand/Collapse Icon */}
                {isExpanded ? (
                  <ChevronDownIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}

                {/* Stage Name */}
                <span
                  className={`font-medium ${
                    isCurrentStage
                      ? 'text-brand-purple'
                      : isPastStage
                      ? 'text-gray-500'
                      : 'text-gray-700'
                  }`}
                >
                  {index + 1}. {stage.name}
                </span>

                {/* Automation Indicator */}
                {hasAutomationRules && (
                  <BoltIcon className="w-4 h-4 text-warning-500" title="Has automation rules" />
                )}

                {/* Current Stage Badge */}
                {isCurrentStage && (
                  <Badge variant="success" className="ml-2">
                    Current stage
                  </Badge>
                )}

                {/* Time in Stage */}
                {stageHistory && isCurrentStage && (
                  <span className="ml-auto text-sm text-gray-500">
                    since {new Date(stageHistory.movedAt).toLocaleDateString()} &middot;{' '}
                    {formatDistanceToNow(new Date(stageHistory.movedAt))}
                  </span>
                )}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 pl-12 space-y-4">
                  {/* Offer Stage - Custom Content */}
                  {stage.name.toLowerCase().includes('offer') ? (
                    <div className="py-4">
                      {offer ? (
                        // Has offer - show view button
                        <div className="text-center">
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-success-50 text-success-700 rounded-lg mb-4">
                            <DocumentTextIcon className="w-5 h-5" />
                            <span className="text-sm font-medium">
                              Offer {offer.status.toLowerCase().replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigateToOffer?.();
                              }}
                            >
                              <DocumentTextIcon className="w-4 h-4 mr-1.5" />
                              View Offer Details
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // No offer - show create button
                        <div className="text-center py-8">
                          <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                            <DocumentTextIcon className="w-10 h-10 text-gray-400" />
                          </div>
                          <p className="text-gray-600 mb-4">No offer has been created yet</p>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToOffer?.();
                            }}
                          >
                            Create Offer
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Regular stages - show Reviewers and Interviews
                    <>
                      {/* Reviewers Section */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-sm font-medium text-gray-700">Reviewers</h4>
                          <button className="text-gray-400 hover:text-gray-600">
                            <PlusIcon className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-500">No feedback submitted</p>
                      </div>

                      {/* Interviews Section */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-sm font-medium text-gray-700">Interviews</h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowScheduleModal(true);
                            }}
                            className="text-gray-400 hover:text-brand-purple transition-colors"
                            title="Schedule interview"
                          >
                            <PlusIcon className="w-4 h-4" />
                          </button>
                        </div>
                        {stageInterviews.length > 0 && (
                          <div className="space-y-2">
                            {stageInterviews.map((interview) => (
                              <div
                                key={interview.id}
                                className="p-3 bg-gray-50 rounded-lg hover:bg-brand-purple/5 hover:border-brand-purple/20 border border-transparent transition-colors group"
                              >
                                {/* Mobile: stacked layout, Desktop: horizontal */}
                                <div className="flex items-start sm:items-center justify-between gap-2">
                                  {/* Left: Interview details */}
                                  <Link
                                    href={`/interviews/${interview.id}`}
                                    className="flex-1 min-w-0"
                                  >
                                    <p className="text-sm font-medium text-brand-purple group-hover:text-brand-purple">
                                      {interview.type.replace(/_/g, ' ')}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      with {interview.interviewer.firstName} {interview.interviewer.lastName}
                                    </p>
                                  </Link>

                                  {/* Delete button - always visible on right */}
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setDeleteInterview({ id: interview.id, type: interview.type.replace(/_/g, ' ') });
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-danger-500 hover:bg-danger-50 rounded transition-colors flex-shrink-0"
                                    title="Delete interview"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Second row: Interview Kit | Interviewer + Rating | Date */}
                                <Link
                                  href={`/interviews/${interview.id}`}
                                  className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-200/50"
                                >
                                  <span className="flex items-center gap-1.5 text-sm text-brand-purple flex-shrink-0">
                                    <BookOpenIcon className="w-4 h-4" />
                                    <span>Interview Kit</span>
                                  </span>

                                  {/* Interviewer name + recommendation icon (Greenhouse style) */}
                                  <span className="flex items-center gap-2 flex-1 justify-center">
                                    <span className="text-sm text-gray-600">
                                      {interview.interviewer.firstName} {interview.interviewer.lastName}
                                    </span>
                                    {(() => {
                                      const scorecard = interview.kitScorecards?.find(s => s.submittedAt);
                                      if (scorecard) {
                                        const rec = scorecard.overallRecommendation;
                                        const iconMap: Record<string, { icon: React.ElementType; color: string }> = {
                                          STRONG_NO: { icon: XCircleIcon, color: 'text-danger-500' },
                                          NO: { icon: HandThumbDownIcon, color: 'text-danger-400' },
                                          YES: { icon: HandThumbUpIcon, color: 'text-success-500' },
                                          STRONG_YES: { icon: StarSolidIcon, color: 'text-yellow-500' },
                                        };
                                        const info = iconMap[rec];
                                        if (info) {
                                          const Icon = info.icon;
                                          return <Icon className={`w-5 h-5 ${info.color}`} />;
                                        }
                                      }
                                      if (interview.feedback.length > 0) return <span className="text-xs text-gray-400">Submitted</span>;
                                      return <span className="text-xs text-gray-400">Pending</span>;
                                    })()}
                                  </span>

                                  <span className="text-sm text-gray-500 flex-shrink-0">
                                    {new Date(interview.scheduledAt).toLocaleDateString()}
                                  </span>
                                </Link>
                              </div>
                            ))}
                          </div>
                        )}
                        {stageInterviews.length === 0 && (
                          <p className="text-sm text-gray-500">No interviews scheduled</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

      {/* Hiring Outcome Panel */}
      {(application.status === 'HIRED' || application.status === 'REJECTED') && (
        <HiringOutcomePanel applicationId={application.id} status={application.status} />
      )}

      {/* Schedule Interview Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowScheduleModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Schedule Interview</h2>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <InterviewForm
              applicationId={application.id}
              jobId={application.job.id}
              candidatePhone={application.candidate.phone}
              onCreated={() => {
                setShowScheduleModal(false);
                onRefresh();
              }}
            />
          </div>
        </div>
      )}

      {/* Delete Interview Confirmation Modal */}
      {deleteInterview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !deleting && setDeleteInterview(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Delete Interview</h2>
              <button
                onClick={() => !deleting && setDeleteInterview(null)}
                className="text-gray-400 hover:text-gray-600"
                disabled={deleting}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete this <strong>{deleteInterview.type}</strong> interview? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteInterview(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteInterview}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-danger-600 hover:bg-danger-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
