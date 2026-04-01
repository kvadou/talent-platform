'use client';

import { useState } from 'react';
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
  };
};

type Props = {
  applicationId: string;
  candidateId: string;
  notes: Note[];
  onRefresh: () => void;
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

export function NotesPanel({ applicationId, candidateId, notes, onRefresh }: Props) {
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, isPrivate }),
      });
      if (res.ok) {
        setContent('');
        setIsPrivate(false);
        onRefresh();
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Notes</h3>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {notes.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">There aren&apos;t any notes yet</p>
            <p className="text-xs text-gray-400 mt-1">Add a note to start collaborating with your team.</p>
          </div>
        ) : (
          notes.map((note) => (
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
          ))
        )}
      </div>

      {/* Add Note Form */}
      <div className="p-4 border-t border-gray-100 bg-white">
        <div className="flex gap-3">
          {/* User Avatar Placeholder */}
          <div className="w-8 h-8 rounded-full bg-brand-purple flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
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
    </div>
  );
}
