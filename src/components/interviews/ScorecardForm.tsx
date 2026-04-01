'use client';

import { useState } from 'react';
import {
  HandThumbUpIcon,
  HandThumbDownIcon,
  CheckCircleIcon,
  StarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import {
  HandThumbUpIcon as HandThumbUpSolid,
  HandThumbDownIcon as HandThumbDownSolid,
  StarIcon as StarSolid,
} from '@heroicons/react/24/solid';

interface ScorecardCriterion {
  id: string;
  name: string;
  description?: string;
}

interface AiSuggestions {
  scores: Record<string, number>;
  recommendation: string;
  strengths: string;
  concerns: string;
}

interface ScorecardFormProps {
  interviewId: string;
  scorecard: {
    id: string;
    name: string;
    description: string | null;
    criteria: unknown;
  } | null;
  existingFeedback: {
    id: string;
    scores: unknown;
    recommendation: string | null;
    strengths: string | null;
    weaknesses: string | null;
    notes: string | null;
    submittedAt: string | null;
  } | null;
  onSubmit: () => void;
  aiSuggestions?: AiSuggestions | null;
}

type Recommendation = 'STRONG_HIRE' | 'HIRE' | 'NO_HIRE' | 'STRONG_NO_HIRE';

const RECOMMENDATION_OPTIONS: Array<{
  value: Recommendation;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = [
  {
    value: 'STRONG_HIRE',
    label: 'Strong Hire',
    description: 'Exceptional candidate, would strongly advocate',
    color: 'text-success-700',
    bgColor: 'bg-success-50',
    borderColor: 'border-success-500',
  },
  {
    value: 'HIRE',
    label: 'Hire',
    description: 'Good candidate, meets requirements',
    color: 'text-success-600',
    bgColor: 'bg-success-50/50',
    borderColor: 'border-success-400',
  },
  {
    value: 'NO_HIRE',
    label: 'No Hire',
    description: 'Does not meet requirements',
    color: 'text-danger-600',
    bgColor: 'bg-danger-50/50',
    borderColor: 'border-danger-400',
  },
  {
    value: 'STRONG_NO_HIRE',
    label: 'Strong No Hire',
    description: 'Significant concerns, would not recommend',
    color: 'text-danger-700',
    bgColor: 'bg-danger-50',
    borderColor: 'border-danger-500',
  },
];

function parseExistingScores(scores: unknown): Record<string, number> {
  if (typeof scores === 'object' && scores !== null) {
    return scores as Record<string, number>;
  }
  return {};
}

function parseCriteria(criteria: unknown): ScorecardCriterion[] {
  if (Array.isArray(criteria)) {
    return criteria.map((c, i) => ({
      id: c.id || `criterion-${i}`,
      name: c.name || c.label || `Criterion ${i + 1}`,
      description: c.description || c.desc || undefined,
    }));
  }
  return [];
}

function isValidRecommendation(value: string): value is Recommendation {
  return ['STRONG_HIRE', 'HIRE', 'NO_HIRE', 'STRONG_NO_HIRE'].includes(value);
}

export function ScorecardForm({
  interviewId,
  scorecard,
  existingFeedback,
  onSubmit,
  aiSuggestions,
}: ScorecardFormProps) {
  const criteria = scorecard ? parseCriteria(scorecard.criteria) : [];
  const existingScores = existingFeedback ? parseExistingScores(existingFeedback.scores) : {};

  // Determine if AI suggestions should be used for initial state
  const useAi = !!aiSuggestions && !existingFeedback;

  const [recommendation, setRecommendation] = useState<Recommendation | null>(() => {
    if (existingFeedback?.recommendation) {
      return existingFeedback.recommendation as Recommendation;
    }
    if (useAi && aiSuggestions.recommendation && isValidRecommendation(aiSuggestions.recommendation)) {
      return aiSuggestions.recommendation;
    }
    return null;
  });

  const [scores, setScores] = useState<Record<string, number>>(() => {
    if (existingFeedback) return existingScores;
    if (useAi) return { ...aiSuggestions.scores };
    return {};
  });

  const [strengths, setStrengths] = useState(() => {
    if (existingFeedback) return existingFeedback.strengths || '';
    if (useAi) return aiSuggestions.strengths || '';
    return '';
  });

  const [weaknesses, setWeaknesses] = useState(() => {
    if (existingFeedback) return existingFeedback.weaknesses || '';
    if (useAi) return aiSuggestions.concerns || '';
    return '';
  });

  const [notes, setNotes] = useState(existingFeedback?.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track which fields have been manually modified from AI values
  const [aiModifiedFields, setAiModifiedFields] = useState<Set<string>>(new Set());

  const markModified = (field: string) => {
    if (!useAi) return;
    setAiModifiedFields((prev) => {
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  };

  const isAiField = (field: string) => useAi && !aiModifiedFields.has(field);

  const handleScoreChange = (criterionId: string, score: number) => {
    setScores((prev) => ({ ...prev, [criterionId]: score }));
    markModified(`score-${criterionId}`);
  };

  const handleRecommendationChange = (value: Recommendation) => {
    setRecommendation(value);
    markModified('recommendation');
  };

  const handleStrengthsChange = (value: string) => {
    setStrengths(value);
    markModified('strengths');
  };

  const handleWeaknessesChange = (value: string) => {
    setWeaknesses(value);
    markModified('weaknesses');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recommendation) {
      setError('Please select a recommendation');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/interviews/${interviewId}/feedback`, {
        method: existingFeedback ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendation,
          scores,
          strengths,
          weaknesses,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit feedback');
      }

      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const isReadOnly = !!existingFeedback?.submittedAt;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* AI Pre-fill Banner */}
      {useAi && (
        <div className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <SparklesIcon className="h-5 w-5 text-purple-500 flex-shrink-0" />
          <p className="text-sm text-purple-700">
            Pre-filled from AI analysis. Review and adjust before submitting.
          </p>
        </div>
      )}

      {/* Overall Recommendation */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Overall Recommendation</h3>
          {useAi && isAiField('recommendation') && (
            <SparklesIcon className="h-4 w-4 text-purple-400" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {RECOMMENDATION_OPTIONS.map((option) => {
            const isSelected = recommendation === option.value;
            const isPositive = option.value.includes('HIRE') && !option.value.includes('NO_HIRE');
            return (
              <button
                key={option.value}
                type="button"
                disabled={isReadOnly}
                onClick={() => handleRecommendationChange(option.value)}
                className={`
                  p-4 rounded-lg border-2 text-left transition-all
                  ${isSelected
                    ? `${option.bgColor} ${option.borderColor} ${option.color}`
                    : 'border-gray-200 hover:border-gray-300'
                  }
                  ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-center gap-3">
                  {isPositive ? (
                    isSelected ? (
                      <HandThumbUpSolid className="h-6 w-6" />
                    ) : (
                      <HandThumbUpIcon className="h-6 w-6 text-gray-400" />
                    )
                  ) : isSelected ? (
                    <HandThumbDownSolid className="h-6 w-6" />
                  ) : (
                    <HandThumbDownIcon className="h-6 w-6 text-gray-400" />
                  )}
                  <div>
                    <div className={`font-medium ${isSelected ? option.color : 'text-gray-900'}`}>
                      {option.label}
                    </div>
                    <div className={`text-xs ${isSelected ? option.color : 'text-gray-500'}`}>
                      {option.description}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scorecard Criteria */}
      {criteria.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {scorecard?.name || 'Evaluation Criteria'}
          </h3>
          {scorecard?.description && (
            <p className="text-sm text-gray-500 mb-4">{scorecard.description}</p>
          )}
          <div className="space-y-4">
            {criteria.map((criterion) => (
              <CriterionRating
                key={criterion.id}
                criterion={criterion}
                value={scores[criterion.id] || 0}
                onChange={(score) => handleScoreChange(criterion.id, score)}
                disabled={isReadOnly}
                isAiFilled={useAi && !!aiSuggestions.scores[criterion.id] && !aiModifiedFields.has(`score-${criterion.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Strengths */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Key Strengths
          </label>
          {useAi && isAiField('strengths') && (
            <span className="inline-flex items-center gap-1 text-xs text-purple-500">
              <SparklesIcon className="h-3 w-3" />
              AI suggested
            </span>
          )}
        </div>
        <textarea
          value={strengths}
          onChange={(e) => handleStrengthsChange(e.target.value)}
          disabled={isReadOnly}
          rows={3}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
          placeholder="What stood out positively about this candidate?"
        />
      </div>

      {/* Weaknesses */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Areas of Concern
          </label>
          {useAi && isAiField('weaknesses') && (
            <span className="inline-flex items-center gap-1 text-xs text-purple-500">
              <SparklesIcon className="h-3 w-3" />
              AI suggested
            </span>
          )}
        </div>
        <textarea
          value={weaknesses}
          onChange={(e) => handleWeaknessesChange(e.target.value)}
          disabled={isReadOnly}
          rows={3}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
          placeholder="What concerns do you have about this candidate?"
        />
      </div>

      {/* Additional Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Additional Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isReadOnly}
          rows={3}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
          placeholder="Any other observations or comments..."
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-danger-50 text-danger-600 rounded-lg text-sm">{error}</div>
      )}

      {/* Submit */}
      {!isReadOnly ? (
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-gray-500">
            Your feedback will be visible to the hiring team.
          </p>
          <button
            type="submit"
            disabled={submitting || !recommendation}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium text-sm"
          >
            {submitting ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-5 w-5" />
                Submit Feedback
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 p-4 bg-success-50 text-success-700 rounded-lg">
          <CheckCircleIcon className="h-5 w-5" />
          <span>Feedback submitted</span>
        </div>
      )}
    </form>
  );
}

function CriterionRating({
  criterion,
  value,
  onChange,
  disabled,
  isAiFilled,
}: {
  criterion: ScorecardCriterion;
  value: number;
  onChange: (score: number) => void;
  disabled: boolean;
  isAiFilled?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{criterion.name}</h4>
          {criterion.description && (
            <p className="text-sm text-gray-500 mt-1">{criterion.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              disabled={disabled}
              onClick={() => onChange(star)}
              className={`p-1 transition-colors ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-110'}`}
            >
              {star <= value ? (
                <StarSolid className="h-6 w-6 text-warning-400" />
              ) : (
                <StarIcon className="h-6 w-6 text-gray-300 hover:text-warning-200" />
              )}
            </button>
          ))}
          {isAiFilled && (
            <SparklesIcon className="h-3 w-3 text-purple-400 ml-1" />
          )}
        </div>
      </div>
    </div>
  );
}
