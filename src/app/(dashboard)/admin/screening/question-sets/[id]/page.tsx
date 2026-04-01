'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  Bars3Icon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { AlertModal } from '@/components/ui/AlertModal';

interface Question {
  id?: string;
  question: string;
  questionType: 'OPEN_ENDED' | 'MULTIPLE_CHOICE' | 'YES_NO' | 'AVAILABILITY' | 'SALARY_EXPECTATION';
  options?: string[];
  isKnockout: boolean;
  knockoutAnswer?: string;
  knockoutMessage?: string;
  evaluationPrompt?: string;
  minAcceptableScore?: number;
}

interface QuestionSet {
  id?: string;
  name: string;
  description: string;
  jobId: string | null;
  isDefault: boolean;
  questions: Question[];
}

interface Job {
  id: string;
  title: string;
}

const QUESTION_TYPES = [
  { value: 'OPEN_ENDED', label: 'Open Ended', description: 'Free text response' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice', description: 'Select from options' },
  { value: 'YES_NO', label: 'Yes/No', description: 'Boolean response' },
  { value: 'AVAILABILITY', label: 'Availability', description: 'Schedule/availability question' },
  { value: 'SALARY_EXPECTATION', label: 'Salary Expectation', description: 'Compensation question' },
];

export default function QuestionSetEditorPage() {
  const router = useRouter();
  const params = useParams();
  const questionSetId = params.id as string;
  const isNew = params.id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [questionSet, setQuestionSet] = useState<QuestionSet>({
    name: '',
    description: '',
    jobId: null,
    isDefault: false,
    questions: [],
  });

  const fetchJobs = useCallback(async () => {
    const res = await fetch('/api/jobs?limit=100');
    const data = await res.json();
    setJobs(data.jobs || []);
  }, []);

  const fetchQuestionSet = useCallback(async () => {
    try {
      const res = await fetch(`/api/screening/question-sets/${questionSetId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setQuestionSet({
        id: data.id,
        name: data.name,
        description: data.description || '',
        jobId: data.jobId,
        isDefault: data.isDefault,
        questions: data.questions.map((q: any) => ({
          id: q.id,
          question: q.question,
          questionType: q.questionType,
          options: q.options || [],
          isKnockout: q.isKnockout,
          knockoutAnswer: q.knockoutAnswer || '',
          knockoutMessage: q.knockoutMessage || '',
          evaluationPrompt: q.evaluationPrompt || '',
          minAcceptableScore: q.minAcceptableScore,
        })),
      });
    } catch (err) {
      setAlertMsg('Failed to load question set');
    } finally {
      setLoading(false);
    }
  }, [questionSetId]);

  useEffect(() => {
    fetchJobs();
    if (!isNew) {
      fetchQuestionSet();
    }
  }, [isNew, fetchJobs, fetchQuestionSet]);

  function addQuestion() {
    setQuestionSet({
      ...questionSet,
      questions: [
        ...questionSet.questions,
        {
          question: '',
          questionType: 'OPEN_ENDED',
          options: [],
          isKnockout: false,
        },
      ],
    });
  }

  function updateQuestion(index: number, updates: Partial<Question>) {
    const newQuestions = [...questionSet.questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setQuestionSet({ ...questionSet, questions: newQuestions });
  }

  function removeQuestion(index: number) {
    setQuestionSet({
      ...questionSet,
      questions: questionSet.questions.filter((_, i) => i !== index),
    });
  }

  function moveQuestion(index: number, direction: 'up' | 'down') {
    const newQuestions = [...questionSet.questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newQuestions.length) return;
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setQuestionSet({ ...questionSet, questions: newQuestions });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const url = isNew ? '/api/screening/question-sets' : `/api/screening/question-sets/${questionSetId}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: questionSet.name,
          description: questionSet.description || null,
          jobId: questionSet.jobId || null,
          isDefault: questionSet.isDefault,
          questions: questionSet.questions.map((q) => ({
            ...(q.id ? { id: q.id } : {}),
            question: q.question,
            questionType: q.questionType,
            options: q.questionType === 'MULTIPLE_CHOICE' ? q.options : null,
            isKnockout: q.isKnockout,
            knockoutAnswer: q.isKnockout ? q.knockoutAnswer : null,
            knockoutMessage: q.isKnockout ? q.knockoutMessage : null,
            evaluationPrompt: q.evaluationPrompt || null,
            minAcceptableScore: q.minAcceptableScore || null,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      router.push('/admin/screening');
    } catch (err) {
      setAlertMsg(err instanceof Error ? err.message : 'Failed to save question set');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/screening"
          className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Question Sets
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? 'Create Question Set' : 'Edit Question Set'}
        </h1>
      </div>

      <AlertModal
        open={!!alertMsg}
        onClose={() => {
          const msg = alertMsg;
          setAlertMsg(null);
          if (msg === 'Failed to load question set') {
            router.push('/admin/screening');
          }
        }}
        title="Notice"
        message={alertMsg || ""}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                required
                value={questionSet.name}
                onChange={(e) => setQuestionSet({ ...questionSet, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="e.g., Standard Tutor Screening"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job (Optional)</label>
              <select
                value={questionSet.jobId || ''}
                onChange={(e) => setQuestionSet({ ...questionSet, jobId: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">All Jobs</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={questionSet.description}
              onChange={(e) => setQuestionSet({ ...questionSet, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Describe the purpose of this question set..."
            />
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={questionSet.isDefault}
                onChange={(e) => setQuestionSet({ ...questionSet, isDefault: e.target.checked })}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Set as default for {questionSet.jobId ? 'this job' : 'all jobs'}</span>
            </label>
          </div>
        </div>

        {/* Questions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
            <button
              type="button"
              onClick={addQuestion}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Add Question
            </button>
          </div>

          {questionSet.questions.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500">No questions yet. Add your first question to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questionSet.questions.map((q, index) => (
                <QuestionEditor
                  key={index}
                  index={index}
                  question={q}
                  onUpdate={(updates) => updateQuestion(index, updates)}
                  onRemove={() => removeQuestion(index)}
                  onMove={(dir) => moveQuestion(index, dir)}
                  isFirst={index === 0}
                  isLast={index === questionSet.questions.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/admin/screening"
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || !questionSet.name || questionSet.questions.length === 0}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isNew ? 'Create Question Set' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function QuestionEditor({
  index,
  question,
  onUpdate,
  onRemove,
  onMove,
  isFirst,
  isLast,
}: {
  index: number;
  question: Question;
  onUpdate: (updates: Partial<Question>) => void;
  onRemove: () => void;
  onMove: (direction: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [optionInput, setOptionInput] = useState('');

  function addOption() {
    if (!optionInput.trim()) return;
    onUpdate({ options: [...(question.options || []), optionInput.trim()] });
    setOptionInput('');
  }

  function removeOption(optIndex: number) {
    onUpdate({ options: (question.options || []).filter((_, i) => i !== optIndex) });
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Bars3Icon className="h-5 w-5 text-gray-400" />
          <span className="font-medium text-gray-700">Question {index + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove('up')}
            disabled={isFirst}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
          >
            &uarr;
          </button>
          <button
            type="button"
            onClick={() => onMove('down')}
            disabled={isLast}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
          >
            &darr;
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-danger-500 hover:text-danger-700"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Question *</label>
          <textarea
            required
            value={question.question}
            onChange={(e) => onUpdate({ question: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
            placeholder="Enter your screening question..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
            <select
              value={question.questionType}
              onChange={(e) => onUpdate({ questionType: e.target.value as Question['questionType'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
            >
              {QUESTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AI Evaluation Prompt</label>
            <input
              type="text"
              value={question.evaluationPrompt || ''}
              onChange={(e) => onUpdate({ evaluationPrompt: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
              placeholder="e.g., Look for specific experience with children"
            />
          </div>
        </div>

        {/* Multiple Choice Options */}
        {question.questionType === 'MULTIPLE_CHOICE' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
            <div className="space-y-2">
              {(question.options || []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm">
                    {opt}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="text-danger-500 hover:text-danger-700"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-sm"
                  placeholder="Add an option..."
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Knockout Settings */}
        <div className="border-t border-gray-200 pt-4 mt-4">
          <label className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={question.isKnockout}
              onChange={(e) => onUpdate({ isKnockout: e.target.checked })}
              className="h-4 w-4 text-danger-600 focus:ring-danger-500 border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <ExclamationTriangleIcon className="h-4 w-4 text-danger-500" />
              Knockout Question
            </span>
          </label>

          {question.isKnockout && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Disqualifying Answer
                </label>
                <input
                  type="text"
                  value={question.knockoutAnswer || ''}
                  onChange={(e) => onUpdate({ knockoutAnswer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-danger-500 focus:border-danger-500 bg-white"
                  placeholder="e.g., No, never"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Message
                </label>
                <input
                  type="text"
                  value={question.knockoutMessage || ''}
                  onChange={(e) => onUpdate({ knockoutMessage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-danger-500 focus:border-danger-500 bg-white"
                  placeholder="Custom rejection message..."
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
