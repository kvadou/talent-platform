'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ClipboardDocumentListIcon,
  Bars3Icon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

type QuestionType = 'TEXT' | 'TEXTAREA' | 'SELECT' | 'BOOLEAN' | 'URL';

type Question = {
  id: string;
  label: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  order: number;
  helpText: string | null;
  greenhouseQuestionId: string | null;
};

const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: 'TEXT', label: 'Short Text', description: 'Single line text input' },
  { value: 'TEXTAREA', label: 'Long Text', description: 'Multi-line text area' },
  { value: 'SELECT', label: 'Dropdown', description: 'Select from predefined options' },
  { value: 'BOOLEAN', label: 'Yes/No', description: 'Simple yes or no question' },
  { value: 'URL', label: 'URL', description: 'Website or link input' },
];

export default function JobFormsPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/questions`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
      }
    } catch (err) {
      console.error('Failed to load questions', err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  function deleteQuestion(id: string) {
    setConfirmDeleteId(id);
  }

  async function confirmDeleteQuestion() {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);

    try {
      const res = await fetch(`/api/jobs/${jobId}/questions/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchQuestions();
      }
    } catch (err) {
      console.error('Failed to delete question', err);
    }
  }

  async function moveQuestion(questionId: string, direction: 'up' | 'down') {
    const index = questions.findIndex(q => q.id === questionId);
    if ((direction === 'up' && index === 0) ||
        (direction === 'down' && index === questions.length - 1)) {
      return;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];

    // Update orders
    const reordered = newQuestions.map((q, i) => ({ id: q.id, order: i }));
    setQuestions(newQuestions.map((q, i) => ({ ...q, order: i })));

    try {
      await fetch(`/api/jobs/${jobId}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: reordered }),
      });
    } catch (err) {
      console.error('Failed to reorder questions', err);
      await fetchQuestions(); // Revert on error
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardDocumentListIcon className="w-6 h-6 text-brand-purple" />
            Application Questions
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Customize screening questions for applicants
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Add Question
        </Button>
      </div>

      <Card>
        <CardHeader title="Screening Questions" />
        <CardContent>
          {questions.length > 0 ? (
            <div className="space-y-3">
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveQuestion(question.id, 'up')}
                      disabled={index === 0}
                      className={`p-1 rounded ${index === 0 ? 'text-gray-300' : 'text-gray-400 hover:text-brand-purple hover:bg-white'}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveQuestion(question.id, 'down')}
                      disabled={index === questions.length - 1}
                      className={`p-1 rounded ${index === questions.length - 1 ? 'text-gray-300' : 'text-gray-400 hover:text-brand-purple hover:bg-white'}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-500">Q{index + 1}.</span>
                      <h4 className="font-medium text-gray-900">{question.label}</h4>
                      <Badge variant="neutral">
                        {QUESTION_TYPES.find(t => t.value === question.type)?.label || question.type}
                      </Badge>
                      {question.required && (
                        <Badge variant="warning">Required</Badge>
                      )}
                      {question.greenhouseQuestionId && (
                        <Badge variant="success">Synced from Greenhouse</Badge>
                      )}
                    </div>
                    {question.helpText && (
                      <p className="text-sm text-gray-500 mt-1">{question.helpText}</p>
                    )}
                    {question.type === 'SELECT' && question.options.length > 0 && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                        <span>Options:</span>
                        {question.options.slice(0, 4).map((opt, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white rounded border border-gray-200">
                            {opt}
                          </span>
                        ))}
                        {question.options.length > 4 && (
                          <span>+{question.options.length - 4} more</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingQuestion(question);
                        setShowModal(true);
                      }}
                      className="p-2 text-gray-400 hover:text-brand-purple rounded-lg hover:bg-white transition-colors"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteQuestion(question.id)}
                      className="p-2 text-gray-400 hover:text-danger-600 rounded-lg hover:bg-white transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ClipboardDocumentListIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No screening questions configured.</p>
              <p className="text-sm text-gray-400 mb-4">
                Add questions to gather more information from applicants beyond their resume.
              </p>
              <Button variant="outline" onClick={() => setShowModal(true)}>
                <PlusIcon className="w-4 h-4 mr-1.5" />
                Add Your First Question
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {questions.length > 0 && (
        <Card>
          <CardContent>
            <div className="flex items-start gap-3 text-sm">
              <CheckCircleIcon className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-gray-700">
                  These questions will appear on the application form for this job.
                </p>
                <p className="text-gray-500 mt-1">
                  Applicant responses help you screen candidates more effectively and identify those who show genuine interest in the position.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDeleteQuestion}
        title="Delete Question"
        message="Delete this question? Existing answers will be preserved but this question will no longer appear on new applications."
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Question Modal */}
      {showModal && (
        <QuestionModal
          jobId={jobId}
          question={editingQuestion}
          onClose={() => {
            setShowModal(false);
            setEditingQuestion(null);
          }}
          onSave={() => {
            setShowModal(false);
            setEditingQuestion(null);
            fetchQuestions();
          }}
        />
      )}
    </div>
  );
}

function QuestionModal({
  jobId,
  question,
  onClose,
  onSave,
}: {
  jobId: string;
  question: Question | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [label, setLabel] = useState(question?.label || '');
  const [type, setType] = useState<QuestionType>(question?.type || 'TEXT');
  const [required, setRequired] = useState(question?.required || false);
  const [helpText, setHelpText] = useState(question?.helpText || '');
  const [options, setOptions] = useState<string[]>(question?.options || ['']);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const url = question
        ? `/api/jobs/${jobId}/questions/${question.id}`
        : `/api/jobs/${jobId}/questions`;

      const body = {
        label,
        type,
        required,
        helpText: helpText || null,
        options: type === 'SELECT' ? options.filter(o => o.trim()) : [],
      };

      const res = await fetch(url, {
        method: question ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSave();
      }
    } catch (err) {
      console.error('Failed to save question', err);
    } finally {
      setSaving(false);
    }
  }

  function addOption() {
    setOptions([...options, '']);
  }

  function updateOption(index: number, value: string) {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  }

  function removeOption(index: number) {
    if (options.length <= 1) return;
    setOptions(options.filter((_, i) => i !== index));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {question ? 'Edit Question' : 'Add Question'}
            </h3>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question Text <span className="text-danger-500">*</span>
              </label>
              <textarea
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                rows={2}
                placeholder="e.g., Why are you interested in this position?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Answer Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as QuestionType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label} - {t.description}
                  </option>
                ))}
              </select>
            </div>

            {type === 'SELECT' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Options
                  </label>
                  <button
                    type="button"
                    onClick={addOption}
                    className="text-sm text-brand-purple hover:underline"
                  >
                    + Add Option
                  </button>
                </div>
                <div className="space-y-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple text-sm"
                      />
                      {options.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="p-2 text-gray-400 hover:text-danger-600"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Help Text (optional)
              </label>
              <input
                type="text"
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                placeholder="Additional context or instructions for the applicant"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="required"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
              />
              <label htmlFor="required" className="text-sm text-gray-700">
                Required question
              </label>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !label.trim()}>
              {saving ? 'Saving...' : question ? 'Update Question' : 'Add Question'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
