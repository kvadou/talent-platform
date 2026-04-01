'use client';

import { useState } from 'react';
import {
  SparklesIcon,
  XMarkIcon,
  CheckCircleIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';

interface AISummary {
  recommendation: string;
  recommendationScore: number;
  strengths: string[];
  concerns: string[];
}

interface Props {
  interviewId: string;
  aiSummary: AISummary;
  humanRecommendation: string;
  onClose: () => void;
  onComplete: () => void;
}

type FeedbackType = 'AGREE' | 'DISAGREE_TOO_HIGH' | 'DISAGREE_TOO_LOW' | 'PARTIALLY_AGREE';

const FEEDBACK_OPTIONS: { value: FeedbackType; label: string; icon: typeof CheckCircleIcon; color: string }[] = [
  { value: 'AGREE', label: 'AI was spot on', icon: CheckCircleIcon, color: 'text-success-600 bg-success-50 border-success-200' },
  { value: 'DISAGREE_TOO_HIGH', label: 'AI was too optimistic', icon: ArrowDownIcon, color: 'text-warning-600 bg-warning-50 border-warning-200' },
  { value: 'DISAGREE_TOO_LOW', label: 'AI was too harsh', icon: ArrowUpIcon, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  { value: 'PARTIALLY_AGREE', label: 'Partially agree', icon: MinusIcon, color: 'text-gray-600 bg-gray-50 border-gray-200' },
];

export function AIFeedbackModal({
  interviewId,
  aiSummary,
  humanRecommendation,
  onClose,
  onComplete,
}: Props) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [wasAIHelpful, setWasAIHelpful] = useState<boolean | null>(null);
  const [incorrectStrengths, setIncorrectStrengths] = useState<string[]>([]);
  const [missedStrengths, setMissedStrengths] = useState('');
  const [incorrectConcerns, setIncorrectConcerns] = useState<string[]>([]);
  const [missedConcerns, setMissedConcerns] = useState('');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleSkip = () => {
    onComplete();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/interviews/${interviewId}/ai-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiRecommendation: aiSummary.recommendation,
          aiScore: aiSummary.recommendationScore,
          humanRecommendation,
          wasAIHelpful,
          feedbackType,
          feedbackNotes: feedbackNotes || null,
          incorrectStrengths: incorrectStrengths.length > 0 ? incorrectStrengths : null,
          missedStrengths: missedStrengths ? [missedStrengths] : null,
          incorrectConcerns: incorrectConcerns.length > 0 ? incorrectConcerns : null,
          missedConcerns: missedConcerns ? [missedConcerns] : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      onComplete();
    } catch (error) {
      console.error('Failed to submit AI feedback:', error);
      // Still complete even if feedback fails - don't block the user
      onComplete();
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStrength = (strength: string) => {
    setIncorrectStrengths(prev =>
      prev.includes(strength)
        ? prev.filter(s => s !== strength)
        : [...prev, strength]
    );
  };

  const toggleConcern = (concern: string) => {
    setIncorrectConcerns(prev =>
      prev.includes(concern)
        ? prev.filter(c => c !== concern)
        : [...prev, concern]
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <SparklesIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Quick AI Feedback</h2>
                <p className="text-sm text-gray-500">Help improve AI recommendations (optional)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Was AI Helpful */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Was the AI analysis helpful in your decision?
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setWasAIHelpful(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${
                  wasAIHelpful === true
                    ? 'border-success-500 bg-success-50 text-success-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <HandThumbUpIcon className="h-5 w-5" />
                Yes, helpful
              </button>
              <button
                onClick={() => setWasAIHelpful(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all ${
                  wasAIHelpful === false
                    ? 'border-danger-500 bg-danger-50 text-danger-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <HandThumbDownIcon className="h-5 w-5" />
                Not really
              </button>
            </div>
          </div>

          {/* Quick Feedback Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              How did AI&apos;s assessment compare to yours?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FEEDBACK_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = feedbackType === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setFeedbackType(option.value)}
                    className={`flex items-center gap-2 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      isSelected ? option.color : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Details Section */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full text-left text-sm text-purple-600 hover:text-purple-700 mb-4 flex items-center gap-1"
          >
            {showDetails ? 'Hide' : 'Show'} detailed feedback
            <svg
              className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDetails && (
            <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
              {/* Incorrect Strengths */}
              {aiSummary.strengths.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Any AI-identified strengths that weren&apos;t accurate?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {aiSummary.strengths.map((strength, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleStrength(strength)}
                        className={`px-3 py-1 rounded-full text-xs transition-all ${
                          incorrectStrengths.includes(strength)
                            ? 'bg-danger-100 text-danger-700 border-2 border-danger-300'
                            : 'bg-success-100 text-success-700 border border-success-200 hover:border-success-300'
                        }`}
                      >
                        {strength}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Missed Strengths */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Any strengths AI missed?
                </label>
                <input
                  type="text"
                  value={missedStrengths}
                  onChange={(e) => setMissedStrengths(e.target.value)}
                  placeholder="e.g., Great energy, Quick learner"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Incorrect Concerns */}
              {aiSummary.concerns.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Any AI concerns that weren&apos;t valid?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {aiSummary.concerns.map((concern, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleConcern(concern)}
                        className={`px-3 py-1 rounded-full text-xs transition-all ${
                          incorrectConcerns.includes(concern)
                            ? 'bg-success-100 text-success-700 border-2 border-success-300'
                            : 'bg-warning-100 text-warning-700 border border-warning-200 hover:border-warning-300'
                        }`}
                      >
                        {concern}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Missed Concerns */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Any concerns AI missed?
                </label>
                <input
                  type="text"
                  value={missedConcerns}
                  onChange={(e) => setMissedConcerns(e.target.value)}
                  placeholder="e.g., Availability issues, Compensation expectations"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Any other feedback?
                </label>
                <textarea
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  placeholder="Optional additional notes..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || (wasAIHelpful === null && feedbackType === null)}
              className="px-6 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
