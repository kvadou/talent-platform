'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import {
  ChatBubbleLeftIcon,
  BookmarkIcon,
  FilmIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';

interface Comment {
  id: string;
  timestamp: number;
  content: string;
  isResolved: boolean;
  author: {
    id: string;
    firstName: string;
    lastName: string;
  };
  replies: Comment[];
  createdAt: string;
}

interface Bookmark {
  id: string;
  timestamp: number;
  label: string;
  color: string | null;
  author: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

interface Clip {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

interface InterviewCollaborationPanelProps {
  interviewId: string;
  recordingId: string;
  currentTime: number;
  duration: number | null;
  onSeek: (time: number) => void;
}

type Tab = 'comments' | 'bookmarks' | 'clips';

const BOOKMARK_COLORS = [
  '#EF4444', // red
  '#F59E0B', // amber
  '#10B981', // green
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
];

export function InterviewCollaborationPanel({
  interviewId,
  recordingId,
  currentTime,
  duration,
  onSeek,
}: InterviewCollaborationPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('comments');
  const [comments, setComments] = useState<Comment[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newComment, setNewComment] = useState('');
  const [newBookmark, setNewBookmark] = useState({ label: '', color: BOOKMARK_COLORS[0] });
  const [newClip, setNewClip] = useState({ title: '', startTime: 0, endTime: 0 });
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isAddingBookmark, setIsAddingBookmark] = useState(false);
  const [isAddingClip, setIsAddingClip] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [commentsRes, bookmarksRes, clipsRes] = await Promise.all([
        fetch(`/api/interviews/${interviewId}/comments`),
        fetch(`/api/interviews/${interviewId}/bookmarks`),
        fetch(`/api/interviews/${interviewId}/clips`),
      ]);

      if (commentsRes.ok) setComments(await commentsRes.json());
      if (bookmarksRes.ok) setBookmarks(await bookmarksRes.json());
      if (clipsRes.ok) setClips(await clipsRes.json());
    } catch (err) {
      console.error('Failed to fetch collaboration data:', err);
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Comment handlers
  async function handleAddComment() {
    if (!newComment.trim()) return;
    try {
      const res = await fetch(`/api/interviews/${interviewId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp: currentTime, content: newComment }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [...prev, { ...comment, replies: [] }].sort((a, b) => a.timestamp - b.timestamp));
        setNewComment('');
        setIsAddingComment(false);
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  }

  async function handleResolveComment(commentId: string, resolved: boolean) {
    try {
      await fetch(`/api/interviews/${interviewId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isResolved: resolved }),
      });
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, isResolved: resolved } : c))
      );
    } catch (err) {
      console.error('Failed to update comment:', err);
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await fetch(`/api/interviews/${interviewId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  }

  // Bookmark handlers
  async function handleAddBookmark() {
    if (!newBookmark.label.trim()) return;
    try {
      const res = await fetch(`/api/interviews/${interviewId}/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: currentTime,
          label: newBookmark.label,
          color: newBookmark.color,
        }),
      });
      if (res.ok) {
        const bookmark = await res.json();
        setBookmarks((prev) => [...prev, bookmark].sort((a, b) => a.timestamp - b.timestamp));
        setNewBookmark({ label: '', color: BOOKMARK_COLORS[0] });
        setIsAddingBookmark(false);
      }
    } catch (err) {
      console.error('Failed to add bookmark:', err);
    }
  }

  async function handleDeleteBookmark(bookmarkId: string) {
    try {
      await fetch(`/api/interviews/${interviewId}/bookmarks/${bookmarkId}`, {
        method: 'DELETE',
      });
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
    } catch (err) {
      console.error('Failed to delete bookmark:', err);
    }
  }

  // Clip handlers
  async function handleAddClip() {
    if (!newClip.title.trim() || newClip.endTime <= newClip.startTime) return;
    try {
      const res = await fetch(`/api/interviews/${interviewId}/clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClip),
      });
      if (res.ok) {
        const clip = await res.json();
        setClips((prev) => [clip, ...prev]);
        setNewClip({ title: '', startTime: 0, endTime: 0 });
        setIsAddingClip(false);
      }
    } catch (err) {
      console.error('Failed to add clip:', err);
    }
  }

  async function handleDeleteClip(clipId: string) {
    try {
      await fetch(`/api/interviews/${interviewId}/clips/${clipId}`, {
        method: 'DELETE',
      });
      setClips((prev) => prev.filter((c) => c.id !== clipId));
    } catch (err) {
      console.error('Failed to delete clip:', err);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-gray-100 rounded" />
          <div className="h-16 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border flex flex-col" style={{ height: '400px' }}>
      {/* Tabs */}
      <div className="flex border-b px-4">
        <button
          onClick={() => setActiveTab('comments')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'comments'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ChatBubbleLeftIcon className="h-4 w-4" />
          Comments
          {comments.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              {comments.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('bookmarks')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'bookmarks'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookmarkIcon className="h-4 w-4" />
          Bookmarks
          {bookmarks.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              {bookmarks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('clips')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'clips'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FilmIcon className="h-4 w-4" />
          Clips
          {clips.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              {clips.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'comments' && (
          <div className="space-y-3">
            {/* Add comment form */}
            {isAddingComment ? (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="font-mono bg-gray-200 px-2 py-0.5 rounded">
                    {formatTime(currentTime)}
                  </span>
                  <span>Adding comment at current time</span>
                </div>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Type your comment..."
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  rows={2}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setIsAddingComment(false);
                      setNewComment('');
                    }}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                  >
                    Add Comment
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingComment(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Add comment at {formatTime(currentTime)}
              </button>
            )}

            {/* Comments list */}
            {comments.length === 0 && !isAddingComment ? (
              <p className="text-center text-sm text-gray-400 py-4">
                No comments yet. Add a timestamped comment to start the discussion.
              </p>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`bg-gray-50 rounded-lg p-3 ${
                    comment.isResolved ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => onSeek(comment.timestamp)}
                      className="font-mono text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded hover:bg-brand-200 transition-colors"
                    >
                      {formatTime(comment.timestamp)}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleResolveComment(comment.id, !comment.isResolved)}
                        className={`p-1 rounded hover:bg-gray-200 ${
                          comment.isResolved ? 'text-success-600' : 'text-gray-400'
                        }`}
                        title={comment.isResolved ? 'Mark unresolved' : 'Mark resolved'}
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="p-1 rounded text-gray-400 hover:bg-gray-200 hover:text-danger-600"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">{comment.content}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {comment.author.firstName} {comment.author.lastName} •{' '}
                    {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'bookmarks' && (
          <div className="space-y-3">
            {/* Add bookmark form */}
            {isAddingBookmark ? (
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="font-mono bg-gray-200 px-2 py-0.5 rounded">
                    {formatTime(currentTime)}
                  </span>
                  <span>Adding bookmark at current time</span>
                </div>
                <input
                  value={newBookmark.label}
                  onChange={(e) => setNewBookmark({ ...newBookmark, label: e.target.value })}
                  placeholder="Bookmark label..."
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Color:</span>
                  {BOOKMARK_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewBookmark({ ...newBookmark, color })}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        newBookmark.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setIsAddingBookmark(false);
                      setNewBookmark({ label: '', color: BOOKMARK_COLORS[0] });
                    }}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddBookmark}
                    disabled={!newBookmark.label.trim()}
                    className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                  >
                    Add Bookmark
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingBookmark(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors"
              >
                <BookmarkIcon className="h-4 w-4" />
                Add bookmark at {formatTime(currentTime)}
              </button>
            )}

            {/* Bookmarks list */}
            {bookmarks.length === 0 && !isAddingBookmark ? (
              <p className="text-center text-sm text-gray-400 py-4">
                No bookmarks yet. Mark important moments for quick reference.
              </p>
            ) : (
              bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors group"
                >
                  <BookmarkSolidIcon
                    className="h-5 w-5 flex-shrink-0"
                    style={{ color: bookmark.color || '#6B7280' }}
                  />
                  <button
                    onClick={() => onSeek(bookmark.timestamp)}
                    className="font-mono text-xs bg-white border px-2 py-0.5 rounded hover:bg-brand-50 hover:border-brand-300 transition-colors"
                  >
                    {formatTime(bookmark.timestamp)}
                  </button>
                  <span className="flex-1 text-sm text-gray-700 truncate">{bookmark.label}</span>
                  <button
                    onClick={() => handleDeleteBookmark(bookmark.id)}
                    className="p-1 rounded text-gray-400 hover:bg-gray-200 hover:text-danger-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'clips' && (
          <div className="space-y-3">
            {/* Add clip form */}
            {isAddingClip ? (
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                <input
                  value={newClip.title}
                  onChange={(e) => setNewClip({ ...newClip, title: e.target.value })}
                  placeholder="Clip title..."
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start time</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={Math.floor(newClip.startTime / 60)}
                        onChange={(e) =>
                          setNewClip({
                            ...newClip,
                            startTime: parseInt(e.target.value) * 60 + (newClip.startTime % 60),
                          })
                        }
                        className="w-16 px-2 py-1 border rounded text-sm"
                        min={0}
                      />
                      <span>:</span>
                      <input
                        type="number"
                        value={Math.floor(newClip.startTime % 60)}
                        onChange={(e) =>
                          setNewClip({
                            ...newClip,
                            startTime:
                              Math.floor(newClip.startTime / 60) * 60 + parseInt(e.target.value),
                          })
                        }
                        className="w-16 px-2 py-1 border rounded text-sm"
                        min={0}
                        max={59}
                      />
                      <button
                        onClick={() => setNewClip({ ...newClip, startTime: currentTime })}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        Use current
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End time</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={Math.floor(newClip.endTime / 60)}
                        onChange={(e) =>
                          setNewClip({
                            ...newClip,
                            endTime: parseInt(e.target.value) * 60 + (newClip.endTime % 60),
                          })
                        }
                        className="w-16 px-2 py-1 border rounded text-sm"
                        min={0}
                      />
                      <span>:</span>
                      <input
                        type="number"
                        value={Math.floor(newClip.endTime % 60)}
                        onChange={(e) =>
                          setNewClip({
                            ...newClip,
                            endTime:
                              Math.floor(newClip.endTime / 60) * 60 + parseInt(e.target.value),
                          })
                        }
                        className="w-16 px-2 py-1 border rounded text-sm"
                        min={0}
                        max={59}
                      />
                      <button
                        onClick={() => setNewClip({ ...newClip, endTime: currentTime })}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        Use current
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setIsAddingClip(false);
                      setNewClip({ title: '', startTime: 0, endTime: 0 });
                    }}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddClip}
                    disabled={!newClip.title.trim() || newClip.endTime <= newClip.startTime}
                    className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                  >
                    Create Clip
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingClip(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors"
              >
                <FilmIcon className="h-4 w-4" />
                Create a clip
              </button>
            )}

            {/* Clips list */}
            {clips.length === 0 && !isAddingClip ? (
              <p className="text-center text-sm text-gray-400 py-4">
                No clips yet. Create clips to mark key moments.
              </p>
            ) : (
              clips.map((clip) => (
                <div key={clip.id} className="bg-gray-50 rounded-lg p-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">{clip.title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <button
                          onClick={() => onSeek(clip.startTime)}
                          className="font-mono hover:text-brand-600"
                        >
                          {formatTime(clip.startTime)}
                        </button>
                        <span>→</span>
                        <button
                          onClick={() => onSeek(clip.endTime)}
                          className="font-mono hover:text-brand-600"
                        >
                          {formatTime(clip.endTime)}
                        </button>
                        <span className="text-gray-300">|</span>
                        <span>{Math.round(clip.endTime - clip.startTime)}s</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteClip(clip.id)}
                      className="p-1.5 rounded text-gray-400 hover:bg-gray-200 hover:text-danger-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {clip.createdBy.firstName} {clip.createdBy.lastName}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
