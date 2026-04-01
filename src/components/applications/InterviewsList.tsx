'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { InterviewForm } from '@/components/interviews/InterviewForm';
import { InterviewFeedbackForm } from '@/components/interviews/InterviewFeedbackForm';
import { format } from 'date-fns';
import {
  ChatBubbleLeftEllipsisIcon,
  CheckCircleIcon,
  ClockIcon,
  StarIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';

type Recommendation = 'STRONG_HIRE' | 'HIRE' | 'NO_HIRE' | 'STRONG_NO_HIRE';

type Feedback = {
  id: string;
  userId: string;
  scores: Record<string, any>;
  recommendation?: Recommendation;
  strengths?: string;
  weaknesses?: string;
  notes?: string;
  submittedAt: string;
};

type Interview = {
  id: string;
  type: string;
  scheduledAt: string;
  duration: number;
  location?: string;
  meetingLink?: string;
  interviewer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  scorecard?: {
    id: string;
    name: string;
    criteria: any[];
  } | null;
  feedback?: Feedback[];
};

const RECOMMENDATION_LABELS: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'error' }> = {
  STRONG_HIRE: { label: 'Strong Hire', variant: 'success' },
  HIRE: { label: 'Hire', variant: 'info' },
  NO_HIRE: { label: 'No Hire', variant: 'warning' },
  STRONG_NO_HIRE: { label: 'Strong No Hire', variant: 'error' },
};

export function InterviewsList({ applicationId, jobId, interviews }: { applicationId: string; jobId?: string; interviews: any[] }) {
  const [items, setItems] = useState<Interview[]>(interviews);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, Feedback[]>>({});
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  // Fetch feedback for all interviews
  useEffect(() => {
    async function fetchFeedback() {
      if (items.length === 0) return;

      try {
        const res = await fetch(`/api/interview-feedback?applicationId=${applicationId}`);
        if (res.ok) {
          const data = await res.json();
          // Group feedback by interview
          const grouped: Record<string, Feedback[]> = {};
          for (const fb of data.feedback) {
            const iid = fb.interview?.id || fb.interviewId;
            if (!grouped[iid]) grouped[iid] = [];
            grouped[iid].push(fb);
          }
          setFeedbackMap(grouped);
        }
      } catch (err) {
        console.error('Failed to fetch feedback:', err);
      }
    }
    fetchFeedback();
  }, [applicationId, items.length]);

  async function refresh() {
    const res = await fetch(`/api/applications/${applicationId}/interviews`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.interviews);
    }
  }

  function handleFeedbackClick(interview: Interview) {
    setSelectedInterview(interview);
    setShowFeedbackForm(true);
  }

  function handleFeedbackSubmitted() {
    // Refresh feedback
    fetch(`/api/interview-feedback?applicationId=${applicationId}`)
      .then((res) => res.json())
      .then((data) => {
        const grouped: Record<string, Feedback[]> = {};
        for (const fb of data.feedback) {
          const iid = fb.interview?.id || fb.interviewId;
          if (!grouped[iid]) grouped[iid] = [];
          grouped[iid].push(fb);
        }
        setFeedbackMap(grouped);
      });
  }

  function getInterviewStatus(interview: Interview) {
    const now = new Date();
    const scheduled = new Date(interview.scheduledAt);
    if (scheduled > now) return 'upcoming';
    return 'completed';
  }

  function calculateAverageScore(feedback: Feedback[]): number | null {
    if (!feedback.length) return null;
    let total = 0;
    let count = 0;
    for (const fb of feedback) {
      for (const [key, value] of Object.entries(fb.scores)) {
        if (typeof value === 'number' && value > 0) {
          total += value;
          count++;
        }
      }
    }
    return count > 0 ? total / count : null;
  }

  return (
    <>
      <Card>
        <CardHeader title="Interviews" />
        <CardContent className="space-y-4">
          <InterviewForm applicationId={applicationId} jobId={jobId} onCreated={refresh} />

          <div className="space-y-3">
            {items.map((iv) => {
              const status = getInterviewStatus(iv);
              const feedback = feedbackMap[iv.id] || [];
              const avgScore = calculateAverageScore(feedback);
              const hasMyFeedback = feedback.length > 0; // Simplified - could check user ID

              return (
                <div
                  key={iv.id}
                  className="border border-gray-200 rounded-xl p-4 hover:border-purple-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Interview Type & Status */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{iv.type.replace(/_/g, ' ')}</span>
                        {status === 'upcoming' ? (
                          <Badge variant="info" size="sm">
                            <ClockIcon className="h-3 w-3 mr-1" />
                            Upcoming
                          </Badge>
                        ) : (
                          <Badge variant={feedback.length > 0 ? 'success' : 'warning'} size="sm">
                            {feedback.length > 0 ? (
                              <>
                                <CheckCircleIcon className="h-3 w-3 mr-1" />
                                {feedback.length} Feedback
                              </>
                            ) : (
                              'Awaiting Feedback'
                            )}
                          </Badge>
                        )}
                      </div>

                      {/* Date & Time */}
                      <div className="text-sm text-gray-600">
                        {format(new Date(iv.scheduledAt), 'EEEE, MMMM d, yyyy')} at{' '}
                        {format(new Date(iv.scheduledAt), 'h:mm a')}
                        <span className="text-gray-400 mx-1">·</span>
                        {iv.duration} min
                      </div>

                      {/* Interviewer */}
                      <div className="text-sm text-gray-500 mt-1">
                        Interviewer: {iv.interviewer.firstName} {iv.interviewer.lastName}
                      </div>

                      {/* Meeting Link */}
                      {iv.meetingLink && (
                        <a
                          href={iv.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-800 mt-2"
                        >
                          <VideoCameraIcon className="h-4 w-4" />
                          Join Meeting
                        </a>
                      )}

                      {/* Feedback Summary */}
                      {feedback.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex flex-wrap gap-2">
                            {avgScore !== null && (
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <StarIcon className="h-4 w-4 text-yellow-500" />
                                <span className="font-medium">{avgScore.toFixed(1)}/5</span>
                                avg score
                              </div>
                            )}
                            {feedback.map((fb) =>
                              fb.recommendation ? (
                                <Badge
                                  key={fb.id}
                                  variant={RECOMMENDATION_LABELS[fb.recommendation]?.variant || 'neutral'}
                                  size="sm"
                                >
                                  {RECOMMENDATION_LABELS[fb.recommendation]?.label || fb.recommendation}
                                </Badge>
                              ) : null
                            )}
                          </div>
                          {feedback[0]?.strengths && (
                            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                              <span className="font-medium text-success-700">Strengths:</span>{' '}
                              {feedback[0].strengths}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0">
                      <Button
                        size="sm"
                        variant={hasMyFeedback ? 'secondary' : 'primary'}
                        onClick={() => handleFeedbackClick(iv)}
                      >
                        <ChatBubbleLeftEllipsisIcon className="h-4 w-4 mr-1" />
                        {hasMyFeedback ? 'View/Edit' : 'Add Feedback'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {items.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No interviews scheduled yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Feedback Form Modal */}
      {showFeedbackForm && selectedInterview && (
        <InterviewFeedbackForm
          interview={selectedInterview}
          existingFeedback={feedbackMap[selectedInterview.id]?.[0] || null}
          onClose={() => {
            setShowFeedbackForm(false);
            setSelectedInterview(null);
          }}
          onSubmitted={handleFeedbackSubmitted}
        />
      )}
    </>
  );
}
