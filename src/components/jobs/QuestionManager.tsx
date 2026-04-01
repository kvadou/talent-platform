'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface JobQuestion {
  id: string;
  label: string;
  type: 'TEXT' | 'TEXTAREA' | 'SELECT' | 'BOOLEAN' | 'URL';
  options: string[];
  required: boolean;
  order: number;
  helpText: string | null;
}

const QUESTION_TYPES = [
  { value: 'TEXT', label: 'Short Text' },
  { value: 'TEXTAREA', label: 'Long Text' },
  { value: 'SELECT', label: 'Dropdown' },
  { value: 'BOOLEAN', label: 'Yes/No' },
  { value: 'URL', label: 'URL' },
];

export function QuestionManager({ jobId }: { jobId: string }) {
  const [questions, setQuestions] = useState<JobQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // New question form state
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<JobQuestion['type']>('TEXT');
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState('');
  const [newHelpText, setNewHelpText] = useState('');

  // Edit form state
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState<JobQuestion['type']>('TEXT');
  const [editRequired, setEditRequired] = useState(false);
  const [editOptions, setEditOptions] = useState('');
  const [editHelpText, setEditHelpText] = useState('');

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/questions`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions);
      }
    } catch (err) {
      console.error('Failed to fetch questions', err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleAdd = async () => {
    if (!newLabel.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newLabel,
          type: newType,
          required: newRequired,
          options: newType === 'SELECT' ? newOptions.split('\n').filter(Boolean) : [],
          helpText: newHelpText || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setQuestions([...questions, data.question]);
        setNewLabel('');
        setNewType('TEXT');
        setNewRequired(false);
        setNewOptions('');
        setNewHelpText('');
        setShowAddForm(false);
      }
    } catch (err) {
      console.error('Failed to add question', err);
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (question: JobQuestion) => {
    setEditingId(question.id);
    setEditLabel(question.label);
    setEditType(question.type);
    setEditRequired(question.required);
    setEditOptions(question.options.join('\n'));
    setEditHelpText(question.helpText || '');
  };

  const handleUpdate = async () => {
    if (!editingId || !editLabel.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/questions/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: editLabel,
          type: editType,
          required: editRequired,
          options: editType === 'SELECT' ? editOptions.split('\n').filter(Boolean) : [],
          helpText: editHelpText || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setQuestions(questions.map(q => q.id === editingId ? data.question : q));
        setEditingId(null);
      }
    } catch (err) {
      console.error('Failed to update question', err);
    } finally {
      setSaving(false);
    }
  };

  const initiateDelete = (id: string) => {
    setPendingDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/questions/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setQuestions(questions.filter(q => q.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete question', err);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader title="Application Questions" />
        <CardContent>
          <p className="text-sm text-gray-500">Loading questions...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Application Questions"
        action={
          !showAddForm && (
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              Add Question
            </Button>
          )
        }
      />
      <CardContent className="space-y-4">
        {questions.length === 0 && !showAddForm && (
          <p className="text-sm text-gray-500">
            No custom questions yet. Add screening questions that candidates must answer when applying.
          </p>
        )}

        {/* Existing Questions */}
        {questions.map((question) => (
          <div
            key={question.id}
            className="border border-gray-200 rounded-lg p-4 bg-gray-50"
          >
            {editingId === question.id ? (
              // Edit Form
              <div className="space-y-3">
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Question label"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as JobQuestion['type'])}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editRequired}
                      onChange={(e) => setEditRequired(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Required</span>
                  </label>
                </div>
                {editType === 'SELECT' && (
                  <textarea
                    value={editOptions}
                    onChange={(e) => setEditOptions(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="Options (one per line)"
                    rows={3}
                  />
                )}
                <input
                  type="text"
                  value={editHelpText}
                  onChange={(e) => setEditHelpText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Help text (optional)"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleUpdate} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              // Display
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {question.label}
                    {question.required && <span className="text-danger-500 ml-1">*</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Type: {QUESTION_TYPES.find(t => t.value === question.type)?.label}
                    {question.type === 'SELECT' && ` (${question.options.length} options)`}
                  </p>
                  {question.helpText && (
                    <p className="text-xs text-gray-400 mt-1">{question.helpText}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStartEdit(question)}
                    className="text-xs text-purple-600 hover:text-purple-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => initiateDelete(question.id)}
                    className="text-xs text-danger-600 hover:text-danger-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Delete Confirmation */}
        <ConfirmModal
          open={showDeleteConfirm}
          onClose={() => { setShowDeleteConfirm(false); setPendingDeleteId(null); }}
          onConfirm={() => {
            setShowDeleteConfirm(false);
            if (pendingDeleteId) handleDelete(pendingDeleteId);
            setPendingDeleteId(null);
          }}
          title="Delete Question"
          message="Delete this question? This cannot be undone."
          confirmLabel="Delete"
          variant="danger"
        />

        {/* Add New Question Form */}
        {showAddForm && (
          <div className="border-2 border-dashed border-purple-200 rounded-lg p-4 bg-purple-50">
            <h4 className="font-medium text-gray-900 mb-3">New Question</h4>
            <div className="space-y-3">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="e.g., Are you 18 years old or older?"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as JobQuestion['type'])}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newRequired}
                    onChange={(e) => setNewRequired(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Required</span>
                </label>
              </div>
              {newType === 'SELECT' && (
                <textarea
                  value={newOptions}
                  onChange={(e) => setNewOptions(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Options (one per line)&#10;Yes&#10;No"
                  rows={3}
                />
              )}
              <input
                type="text"
                value={newHelpText}
                onChange={(e) => setNewHelpText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Help text shown below question (optional)"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} disabled={saving || !newLabel.trim()}>
                  {saving ? 'Adding...' : 'Add Question'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  setShowAddForm(false);
                  setNewLabel('');
                  setNewType('TEXT');
                  setNewRequired(false);
                  setNewOptions('');
                  setNewHelpText('');
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
