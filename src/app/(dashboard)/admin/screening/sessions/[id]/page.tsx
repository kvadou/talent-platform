'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeftIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  PhoneIcon,
  PauseCircleIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  UserIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { AlertModal } from '@/components/ui/AlertModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface Message {
  id: string;
  role: 'AI' | 'CANDIDATE' | 'SYSTEM' | 'RECRUITER';
  content: string;
  sentAt: string;
  aiScore: number | null;
  aiAnalysis: string | null;
  questionOrder: number | null;
}

interface Session {
  id: string;
  type: string;
  status: string;
  aiScore: number | null;
  aiRecommendation: string | null;
  aiNotes: string | null;
  knockoutTriggered: boolean;
  knockoutReason: string | null;
  humanDecision: string | null;
  humanNotes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  application: {
    id: string;
    candidate: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
    };
    job: { id: string; title: string };
  };
  questionSet: {
    id: string;
    name: string;
    questions: Array<{ id: string; question: string; order: number }>;
  } | null;
  messages: Message[];
  humanReviewer: { firstName: string; lastName: string } | null;
}

const DECISION_OPTIONS = [
  { value: 'ADVANCE', label: 'Advance', icon: CheckCircleIcon, color: 'green' },
  { value: 'SCHEDULE_CALL', label: 'Schedule Call', icon: PhoneIcon, color: 'yellow' },
  { value: 'HOLD', label: 'Hold', icon: PauseCircleIcon, color: 'gray' },
  { value: 'REJECT', label: 'Reject', icon: XCircleIcon, color: 'red' },
];

export default function SessionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDecision, setSelectedDecision] = useState<string | null>(null);
  const [humanNotes, setHumanNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [recruiterMessage, setRecruiterMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [showTakeoverConfirm, setShowTakeoverConfirm] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/screening/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSession(data);
      setSelectedDecision(data.humanDecision);
      setHumanNotes(data.humanNotes || '');
    } catch (err) {
      setAlertMsg('Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  async function handleSaveDecision() {
    if (!selectedDecision) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/screening/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ humanDecision: selectedDecision, humanNotes }),
      });

      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      setSession((prev) => (prev ? { ...prev, ...data } : prev));
      setAlertMsg('Decision saved successfully!');
    } catch (err) {
      setAlertMsg('Failed to save decision');
    } finally {
      setSaving(false);
    }
  }

  function handleTakeover() {
    setShowTakeoverConfirm(true);
  }

  async function confirmTakeover() {
    setShowTakeoverConfirm(false);
    setSaving(true);

    try {
      const res = await fetch(`/api/screening/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'HUMAN_TAKEOVER' }),
      });

      if (!res.ok) throw new Error('Failed to take over');
      const data = await res.json();
      setSession((prev) => (prev ? { ...prev, ...data } : prev));
    } catch (err) {
      setAlertMsg('Failed to take over conversation');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendMessage() {
    if (!recruiterMessage.trim()) return;
    setSendingMessage(true);

    try {
      const res = await fetch(`/api/screening/sessions/${params.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: recruiterMessage, role: 'RECRUITER' }),
      });

      if (!res.ok) throw new Error('Failed to send');
      setRecruiterMessage('');
      fetchSession(); // Refresh to get new message
    } catch (err) {
      setAlertMsg('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const handleAlertClose = () => {
    const msg = alertMsg;
    setAlertMsg(null);
    if (msg === 'Failed to load session') {
      router.push('/admin/screening/sessions');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <AlertModal open={!!alertMsg} onClose={handleAlertClose} title="Notice" message={alertMsg || ""} />
      <ConfirmModal
        open={showTakeoverConfirm}
        onClose={() => setShowTakeoverConfirm(false)}
        onConfirm={confirmTakeover}
        title="Take Over Conversation"
        message="Take over this conversation? You will be able to send messages directly to the candidate."
        confirmLabel="Take Over"
        variant="primary"
      />

      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/screening/sessions"
          className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Sessions
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              {session.application.candidate.firstName} {session.application.candidate.lastName}
            </h1>
            <p className="text-gray-600 mt-1">
              {session.application.job.title} &bull; {session.application.candidate.email}
              {session.application.candidate.phone && ` &bull; ${session.application.candidate.phone}`}
            </p>
          </div>

          <Link
            href={`/applications/${session.application.id}`}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            View Application
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[600px]">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <ChatBubbleLeftRightIcon className="h-5 w-5 text-purple-600" />
              Conversation
            </h2>
            {['IN_PROGRESS', 'AWAITING_RESPONSE'].includes(session.status) && (
              <button
                onClick={handleTakeover}
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
              >
                Take Over
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {session.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Recruiter Input (if takeover) */}
          {session.status === 'HUMAN_TAKEOVER' && (
            <div className="px-4 py-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={recruiterMessage}
                  onChange={(e) => setRecruiterMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !recruiterMessage.trim()}
                  className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* AI Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-purple-600" />
              AI Analysis
            </h3>

            {session.knockoutTriggered && (
              <div className="mb-3 p-3 bg-danger-50 border border-danger-200 rounded-lg">
                <div className="flex items-center gap-2 text-danger-700 font-medium">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  Knockout Triggered
                </div>
                {session.knockoutReason && (
                  <p className="text-sm text-danger-600 mt-1">{session.knockoutReason}</p>
                )}
              </div>
            )}

            {session.aiScore !== null && (
              <div className="mb-3">
                <span className="text-sm text-gray-500">Score</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        session.aiScore >= 70 ? 'bg-success-500' : session.aiScore >= 50 ? 'bg-yellow-500' : 'bg-danger-500'
                      }`}
                      style={{ width: `${session.aiScore}%` }}
                    />
                  </div>
                  <span className="font-semibold text-gray-900">{session.aiScore}/100</span>
                </div>
              </div>
            )}

            {session.aiRecommendation && (
              <div className="mb-3">
                <span className="text-sm text-gray-500">Recommendation</span>
                <p className="font-medium text-gray-900">{session.aiRecommendation.replace('_', ' ')}</p>
              </div>
            )}

            {session.aiNotes && (
              <div>
                <span className="text-sm text-gray-500">Notes</span>
                <p className="text-sm text-gray-700 mt-1">{session.aiNotes}</p>
              </div>
            )}
          </div>

          {/* Human Decision */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Your Decision</h3>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {DECISION_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedDecision === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedDecision(opt.value)}
                    className={`p-2 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                      isSelected
                        ? `border-${opt.color}-500 bg-${opt.color}-50 text-${opt.color}-700`
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={humanNotes}
                onChange={(e) => setHumanNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                placeholder="Add notes about your decision..."
              />
            </div>

            <button
              onClick={handleSaveDecision}
              disabled={saving || !selectedDecision}
              className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Decision'}
            </button>

            {session.humanReviewer && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Reviewed by {session.humanReviewer.firstName} {session.humanReviewer.lastName}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isAI = message.role === 'AI';
  const isRecruiter = message.role === 'RECRUITER';
  const isSystem = message.role === 'SYSTEM';

  if (isSystem) {
    return (
      <div className="text-center text-sm text-gray-500 py-2">
        {message.content}
      </div>
    );
  }

  return (
    <div className={`flex ${isAI || isRecruiter ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isAI
            ? 'bg-purple-100 text-purple-900'
            : isRecruiter
            ? 'bg-cyan-100 text-cyan-900'
            : 'bg-gray-900 text-white'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          {isAI ? (
            <SparklesIcon className="h-4 w-4" />
          ) : isRecruiter ? (
            <UserIcon className="h-4 w-4" />
          ) : null}
          <span className="text-xs font-medium">
            {isAI ? 'AI' : isRecruiter ? 'Recruiter' : 'Candidate'}
          </span>
          <span className="text-xs opacity-70">
            {format(new Date(message.sentAt), 'h:mm a')}
          </span>
        </div>
        <p className="whitespace-pre-wrap">{message.content}</p>

        {message.aiScore !== null && (
          <div className="mt-2 pt-2 border-t border-purple-200">
            <span className="text-xs">
              Score: <strong>{message.aiScore}/100</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
