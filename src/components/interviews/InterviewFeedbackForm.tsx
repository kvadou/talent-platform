'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { XMarkIcon, StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

type ScoringType = 'SCALE' | 'BOOLEAN' | 'TEXT';
type Recommendation = 'STRONG_HIRE' | 'HIRE' | 'NO_HIRE' | 'STRONG_NO_HIRE';

type Criterion = {
  id: string;
  name: string;
  description?: string;
  scoringType: ScoringType;
  weight?: number;
};

type Scorecard = {
  id: string;
  name: string;
  criteria: Criterion[];
};

type Interview = {
  id: string;
  type: string;
  scheduledAt: string;
  scorecard?: Scorecard | null;
};

type ExistingFeedback = {
  id: string;
  scores: Record<string, any>;
  recommendation?: Recommendation;
  strengths?: string;
  weaknesses?: string;
  notes?: string;
};

type Props = {
  interview: Interview;
  existingFeedback?: ExistingFeedback | null;
  onClose: () => void;
  onSubmitted: () => void;
};

const RECOMMENDATIONS: { value: Recommendation; label: string; color: string }[] = [
  { value: 'STRONG_HIRE', label: 'Strong Hire', color: 'bg-success-100 text-success-800 border-success-300' },
  { value: 'HIRE', label: 'Hire', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { value: 'NO_HIRE', label: 'No Hire', color: 'bg-warning-100 text-warning-800 border-warning-300' },
  { value: 'STRONG_NO_HIRE', label: 'Strong No Hire', color: 'bg-danger-100 text-danger-800 border-danger-300' },
];

// Default criteria if no scorecard is assigned
const DEFAULT_CRITERIA: Criterion[] = [
  { id: 'technical', name: 'Technical Skills', scoringType: 'SCALE' },
  { id: 'communication', name: 'Communication', scoringType: 'SCALE' },
  { id: 'culture_fit', name: 'Culture Fit', scoringType: 'SCALE' },
  { id: 'problem_solving', name: 'Problem Solving', scoringType: 'SCALE' },
];

export function InterviewFeedbackForm({ interview, existingFeedback, onClose, onSubmitted }: Props) {
  const criteria = interview.scorecard?.criteria || DEFAULT_CRITERIA;

  const [scores, setScores] = useState<Record<string, any>>(() => {
    if (existingFeedback?.scores) return existingFeedback.scores;
    // Initialize scores
    const initial: Record<string, any> = {};
    criteria.forEach((c) => {
      if (c.scoringType === 'SCALE') initial[c.id] = 0;
      else if (c.scoringType === 'BOOLEAN') initial[c.id] = null;
      else initial[c.id] = '';
    });
    return initial;
  });

  const [recommendation, setRecommendation] = useState<Recommendation | null>(
    existingFeedback?.recommendation || null
  );
  const [strengths, setStrengths] = useState(existingFeedback?.strengths || '');
  const [weaknesses, setWeaknesses] = useState(existingFeedback?.weaknesses || '');
  const [notes, setNotes] = useState(existingFeedback?.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload = {
      ...(existingFeedback ? { id: existingFeedback.id } : { interviewId: interview.id }),
      scores,
      recommendation,
      strengths: strengths || null,
      weaknesses: weaknesses || null,
      notes: notes || null,
    };

    try {
      const res = await fetch('/api/interview-feedback', {
        method: existingFeedback ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit feedback');
      }

      onSubmitted();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function renderScaleInput(criterion: Criterion) {
    const value = scores[criterion.id] || 0;
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setScores({ ...scores, [criterion.id]: star })}
            className="p-1 hover:scale-110 transition-transform"
          >
            {star <= value ? (
              <StarSolidIcon className="h-6 w-6 text-yellow-400" />
            ) : (
              <StarIcon className="h-6 w-6 text-gray-300 hover:text-yellow-300" />
            )}
          </button>
        ))}
        <span className="ml-2 text-sm text-gray-500 self-center">
          {value > 0 ? `${value}/5` : 'Not rated'}
        </span>
      </div>
    );
  }

  function renderBooleanInput(criterion: Criterion) {
    const value = scores[criterion.id];
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setScores({ ...scores, [criterion.id]: true })}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            value === true
              ? 'bg-success-100 text-success-800 border-2 border-success-400'
              : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => setScores({ ...scores, [criterion.id]: false })}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            value === false
              ? 'bg-danger-100 text-danger-800 border-2 border-danger-400'
              : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
          }`}
        >
          No
        </button>
      </div>
    );
  }

  function renderTextInput(criterion: Criterion) {
    return (
      <textarea
        value={scores[criterion.id] || ''}
        onChange={(e) => setScores({ ...scores, [criterion.id]: e.target.value })}
        rows={2}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        placeholder={`Enter ${criterion.name.toLowerCase()}...`}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {existingFeedback ? 'Edit Feedback' : 'Submit Feedback'}
            </h2>
            <p className="text-sm text-gray-500">
              {interview.type} - {new Date(interview.scheduledAt).toLocaleDateString()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
              {error}
            </div>
          )}

          {/* Scorecard Name */}
          {interview.scorecard && (
            <div className="text-sm text-gray-500">
              Using scorecard: <span className="font-medium">{interview.scorecard.name}</span>
            </div>
          )}

          {/* Criteria Scores */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Evaluation Criteria</h3>
            {criteria.map((criterion) => (
              <div key={criterion.id} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {criterion.name}
                  {criterion.description && (
                    <span className="font-normal text-gray-500 ml-2">
                      - {criterion.description}
                    </span>
                  )}
                </label>
                {criterion.scoringType === 'SCALE' && renderScaleInput(criterion)}
                {criterion.scoringType === 'BOOLEAN' && renderBooleanInput(criterion)}
                {criterion.scoringType === 'TEXT' && renderTextInput(criterion)}
              </div>
            ))}
          </div>

          {/* Recommendation */}
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">Overall Recommendation</h3>
            <div className="flex flex-wrap gap-2">
              {RECOMMENDATIONS.map((rec) => (
                <button
                  key={rec.value}
                  type="button"
                  onClick={() => setRecommendation(rec.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    recommendation === rec.value
                      ? `${rec.color} border-2`
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {rec.label}
                </button>
              ))}
            </div>
          </div>

          {/* Strengths */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Strengths</label>
            <textarea
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="What did the candidate do well?"
            />
          </div>

          {/* Weaknesses */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Areas for Improvement</label>
            <textarea
              value={weaknesses}
              onChange={(e) => setWeaknesses(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="What could the candidate improve on?"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Additional Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Any other observations or comments..."
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : existingFeedback ? 'Update Feedback' : 'Submit Feedback'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
