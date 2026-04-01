'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { AlertModal } from '@/components/ui/AlertModal';
import {
  PlusIcon,
  ChatBubbleLeftRightIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  StarIcon,
  DocumentTextIcon,
  ListBulletIcon,
  CheckCircleIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

interface SurveyQuestion {
  id?: string;
  text: string;
  type: 'TEXT' | 'TEXTAREA' | 'SELECT' | 'MULTI_SELECT' | 'RATING' | 'YES_NO';
  options: string[];
  isRequired: boolean;
}

interface Survey {
  id: string;
  name: string;
  description: string | null;
  triggerEvent: string;
  delayHours: number;
  isActive: boolean;
  questions: SurveyQuestion[];
  responseCount: number;
  avgRating: number | null;
  createdAt: string;
}

const TRIGGER_EVENTS = [
  { value: 'after_application', label: 'After Application Submitted' },
  { value: 'after_interview', label: 'After Interview Completed' },
  { value: 'after_rejection', label: 'After Rejection' },
  { value: 'after_offer', label: 'After Offer Sent' },
  { value: 'manual', label: 'Manual Send Only' },
];

const QUESTION_TYPES = [
  { value: 'TEXT', label: 'Short Text Response', icon: DocumentTextIcon },
  { value: 'TEXTAREA', label: 'Long Text Response', icon: DocumentTextIcon },
  { value: 'RATING', label: 'Rating (1-5 Stars)', icon: StarIcon },
  { value: 'SELECT', label: 'Single Choice', icon: ListBulletIcon },
  { value: 'MULTI_SELECT', label: 'Multiple Choice', icon: ListBulletIcon },
  { value: 'YES_NO', label: 'Yes/No', icon: CheckCircleIcon },
];

export default function CandidateSurveyPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    triggerEvent: 'after_application',
    delayHours: 24,
    isActive: true,
  });
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    try {
      const response = await fetch('/api/surveys');
      if (response.ok) {
        const data = await response.json();
        setSurveys(data.surveys);
      }
    } catch (error) {
      console.error('Error fetching surveys:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingSurvey(null);
    setFormData({
      name: '',
      description: '',
      triggerEvent: 'after_application',
      delayHours: 24,
      isActive: true,
    });
    setQuestions([
      {
        text: '',
        type: 'RATING',
        options: [],
        isRequired: true,
      },
    ]);
    setShowModal(true);
  };

  const openEditModal = (survey: Survey) => {
    setEditingSurvey(survey);
    setFormData({
      name: survey.name,
      description: survey.description || '',
      triggerEvent: survey.triggerEvent,
      delayHours: survey.delayHours,
      isActive: survey.isActive,
    });
    setQuestions(
      survey.questions.length > 0
        ? survey.questions.map((q) => ({
            id: q.id,
            text: q.text,
            type: q.type,
            options: q.options || [],
            isRequired: q.isRequired,
          }))
        : [{ text: '', type: 'RATING', options: [], isRequired: true }]
    );
    setShowModal(true);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        text: '',
        type: 'TEXT',
        options: [],
        isRequired: true,
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index: number, updates: Partial<SurveyQuestion>) => {
    setQuestions(
      questions.map((q, i) => (i === index ? { ...q, ...updates } : q))
    );
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === questions.length - 1)
    ) {
      return;
    }

    const newQuestions = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[targetIndex]] = [
      newQuestions[targetIndex],
      newQuestions[index],
    ];
    setQuestions(newQuestions);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setAlertMsg('Please enter a survey name');
      return;
    }

    const validQuestions = questions.filter((q) => q.text.trim());
    if (validQuestions.length === 0) {
      setAlertMsg('Please add at least one question');
      return;
    }

    setSaving(true);

    try {
      const url = editingSurvey
        ? `/api/surveys/${editingSurvey.id}`
        : '/api/surveys';
      const method = editingSurvey ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          questions: validQuestions,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        fetchSurveys();
      } else {
        const data = await response.json();
        setAlertMsg(data.error || 'Failed to save survey');
      }
    } catch (error) {
      console.error('Error saving survey:', error);
      setAlertMsg('Failed to save survey');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/surveys/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSurveys(surveys.filter((s) => s.id !== id));
        setShowDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Error deleting survey:', error);
    }
  };

  const toggleActive = async (survey: Survey) => {
    try {
      const response = await fetch(`/api/surveys/${survey.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !survey.isActive }),
      });

      if (response.ok) {
        setSurveys(
          surveys.map((s) =>
            s.id === survey.id ? { ...s, isActive: !s.isActive } : s
          )
        );
      }
    } catch (error) {
      console.error('Error toggling survey status:', error);
    }
  };

  const getTriggerLabel = (value: string) => {
    return TRIGGER_EVENTS.find((t) => t.value === value)?.label || value;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Candidate Survey</h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure candidate feedback surveys
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-purple"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Candidate Survey</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure candidate feedback surveys to collect insights about your hiring process
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Survey
        </Button>
      </div>

      <Card>
        <CardHeader title="Surveys" />
        <CardContent className="p-0">
          {surveys.length === 0 ? (
            <div className="p-8 text-center">
              <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No surveys created yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Create a survey to collect feedback from candidates
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {surveys.map((survey) => (
                <div
                  key={survey.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-cyan-50 rounded-lg">
                      <ChatBubbleLeftRightIcon className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {survey.name}
                        </span>
                        <Badge
                          variant={survey.isActive ? 'success' : 'warning'}
                        >
                          {survey.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          {getTriggerLabel(survey.triggerEvent)}
                          {survey.triggerEvent !== 'manual' && (
                            <> ({survey.delayHours}h delay)</>
                          )}
                        </span>
                        <span>{survey.questions.length} questions</span>
                        <span>{survey.responseCount} responses</span>
                        {survey.avgRating !== null && (
                          <span className="flex items-center gap-1">
                            <StarIcon className="w-4 h-4 text-yellow-500" />
                            {survey.avgRating.toFixed(1)}/5
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(survey)}
                      className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                        survey.isActive
                          ? 'text-warning-600 hover:bg-warning-50'
                          : 'text-success-600 hover:bg-success-50'
                      }`}
                    >
                      {survey.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => openEditModal(survey)}
                      className="p-2 text-gray-400 hover:text-brand-purple hover:bg-purple-50 rounded-lg"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(survey.id)}
                      className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingSurvey ? 'Edit Survey' : 'Create Survey'}
        className="max-w-2xl"
      >
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Survey Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                placeholder="e.g., Post-Interview Feedback"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                placeholder="Brief description of the survey purpose"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trigger Event
                </label>
                <select
                  value={formData.triggerEvent}
                  onChange={(e) =>
                    setFormData({ ...formData, triggerEvent: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                >
                  {TRIGGER_EVENTS.map((trigger) => (
                    <option key={trigger.value} value={trigger.value}>
                      {trigger.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delay (Hours)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.delayHours}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      delayHours: parseInt(e.target.value) || 0,
                    })
                  }
                  disabled={formData.triggerEvent === 'manual'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple disabled:bg-gray-100"
                />
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="w-4 h-4 text-brand-purple border-gray-300 rounded focus:ring-brand-purple"
              />
              <span className="text-sm text-gray-700">
                Survey is active and will be sent automatically
              </span>
            </label>
          </div>

          {/* Questions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Questions
              </label>
              <Button size="sm" variant="outline" onClick={addQuestion}>
                <PlusIcon className="w-4 h-4 mr-1" />
                Add Question
              </Button>
            </div>

            <div className="space-y-4">
              {questions.map((question, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 rounded-lg space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={question.text}
                        onChange={(e) =>
                          updateQuestion(index, { text: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple"
                        placeholder="Enter your question"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveQuestion(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <ChevronUpIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveQuestion(index, 'down')}
                        disabled={index === questions.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        <ChevronDownIcon className="w-4 h-4" />
                      </button>
                      {questions.length > 1 && (
                        <button
                          onClick={() => removeQuestion(index)}
                          className="p-1 text-danger-400 hover:text-danger-600"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <select
                        value={question.type}
                        onChange={(e) =>
                          updateQuestion(index, {
                            type: e.target.value as SurveyQuestion['type'],
                            options:
                              e.target.value === 'SELECT' || e.target.value === 'MULTI_SELECT'
                                ? ['Option 1', 'Option 2']
                                : [],
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple text-sm"
                      >
                        {QUESTION_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={question.isRequired}
                        onChange={(e) =>
                          updateQuestion(index, { isRequired: e.target.checked })
                        }
                        className="w-4 h-4 text-brand-purple border-gray-300 rounded focus:ring-brand-purple"
                      />
                      <span className="text-sm text-gray-600">Required</span>
                    </label>
                  </div>

                  {(question.type === 'SELECT' || question.type === 'MULTI_SELECT') && (
                    <div className="space-y-2">
                      <label className="block text-xs text-gray-500">
                        Options (one per line)
                      </label>
                      <textarea
                        value={question.options.join('\n')}
                        onChange={(e) =>
                          updateQuestion(index, {
                            options: e.target.value.split('\n'),
                          })
                        }
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-brand-purple text-sm"
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingSurvey ? 'Update Survey' : 'Create Survey'}
            </Button>
          </div>
        </div>
      </Modal>

      <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} title="Notice" message={alertMsg || ""} />

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Delete Survey"
        className="max-w-md"
      >
        <p className="text-gray-600">
          Are you sure you want to delete this survey? This action cannot be
          undone and all associated responses will be lost.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
          >
            Delete Survey
          </Button>
        </div>
      </Modal>
    </div>
  );
}
