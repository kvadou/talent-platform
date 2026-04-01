'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { formatDistanceToNow } from 'date-fns';

type Note = {
  id: string;
  content: string;
  isPrivate: boolean;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = [
    'bg-purple-500',
    'bg-cyan-500',
    'bg-success-500',
    'bg-warning-500',
    'bg-danger-500',
    'bg-purple-500',
    'bg-success-500',
    'bg-warning-500',
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
}

export function CandidateNotes({ candidateId }: { candidateId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/candidates/${candidateId}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.candidate.candidateNotes || []);
      }
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function handleSubmit() {
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, isPrivate }),
      });
      if (res.ok) {
        setContent('');
        setIsPrivate(false);
        fetchNotes();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <Card>
      <CardHeader title="Notes" />
      <CardContent className="space-y-4">
        {/* Notes List */}
        {loading ? (
          <div className="text-sm text-gray-500">Loading notes...</div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm font-medium text-gray-700">There aren&apos;t any notes yet</p>
            <p className="text-xs text-gray-500 mt-1">Add a note to start collaborating with your team.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {notes.map((note) => (
              <div key={note.id} className="flex gap-3">
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 ${getAvatarColor(
                    note.author.firstName + note.author.lastName
                  )}`}
                >
                  {getInitials(note.author.firstName, note.author.lastName)}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {note.author.firstName} {note.author.lastName}
                      </span>
                      {note.isPrivate && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                          Private
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Note Form */}
        <div className="border-t pt-4">
          <div className="flex gap-3">
            {/* User Avatar Placeholder */}
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
              You
            </div>
            {/* Input Area */}
            <div className="flex-1">
              <div className="relative">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tip: @mention someone"
                  className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
                  rows={2}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!content.trim() || submitting}
                  className="absolute right-2 bottom-2 p-1.5 text-gray-400 hover:text-brand-purple disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </div>
              {/* Options */}
              <div className="flex items-center gap-4 mt-2">
                <select
                  value={isPrivate ? 'private' : 'public'}
                  onChange={(e) => setIsPrivate(e.target.value === 'private')}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
