'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  FunnelIcon,
  ChatBubbleBottomCenterTextIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { AlertModal } from '@/components/ui/AlertModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface Pattern {
  id: string;
  patternType: string;
  pattern: string;
  context: string | null;
  positiveSignal: boolean;
  weight: number;
  confidence: number;
  exampleCount: number;
  isVerified: boolean;
  verifiedAt: string | null;
  job: { id: string; title: string } | null;
  verifiedBy: { firstName: string; lastName: string } | null;
  createdAt: string;
}

interface QAExample {
  id: string;
  question: string;
  questionIntent: string | null;
  exampleAnswer: string;
  isGoodExample: boolean;
  explanation: string | null;
  qualityScore: number | null;
  isVerified: boolean;
  job: { id: string; title: string } | null;
  verifiedBy: { firstName: string; lastName: string } | null;
  createdAt: string;
}

const PATTERN_TYPE_ICONS: Record<string, typeof SparklesIcon> = {
  ANSWER_QUALITY: ChatBubbleBottomCenterTextIcon,
  COMMUNICATION_STYLE: ChatBubbleBottomCenterTextIcon,
  ENTHUSIASM_SIGNAL: LightBulbIcon,
  RED_FLAG: ExclamationTriangleIcon,
  EXPERIENCE_CLAIM: CheckCircleIcon,
  QUESTION_ASKED: QuestionMarkCircleIcon,
};

const PATTERN_TYPE_LABELS: Record<string, string> = {
  ANSWER_QUALITY: 'Answer Quality',
  COMMUNICATION_STYLE: 'Communication Style',
  ENTHUSIASM_SIGNAL: 'Enthusiasm Signal',
  RED_FLAG: 'Red Flag',
  EXPERIENCE_CLAIM: 'Experience Claim',
  QUESTION_ASKED: 'Question Asked',
};

export default function PatternsReviewPage() {
  const [activeTab, setActiveTab] = useState<'patterns' | 'qa'>('patterns');
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [qaExamples, setQAExamples] = useState<QAExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'verified' | 'unverified'>('unverified');
  const [counts, setCounts] = useState({ verified: 0, unverified: 0 });
  const [qaCounts, setQACounts] = useState({ verified: 0, unverified: 0, good: 0, bad: 0 });
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [confirmDeletePatternId, setConfirmDeletePatternId] = useState<string | null>(null);
  const [confirmDeleteQAId, setConfirmDeleteQAId] = useState<string | null>(null);

  const fetchPatterns = useCallback(async () => {
    setLoading(true);
    try {
      const isVerified = filter === 'all' ? '' : filter === 'verified' ? 'true' : 'false';
      const res = await fetch(`/api/patterns?isVerified=${isVerified}&limit=100`);
      const data = await res.json();
      setPatterns(data.patterns || []);
      setCounts(data.counts || { verified: 0, unverified: 0 });
    } catch (error) {
      console.error('Failed to fetch patterns:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchQAExamples = useCallback(async () => {
    setLoading(true);
    try {
      const isVerified = filter === 'all' ? '' : filter === 'verified' ? 'true' : 'false';
      const res = await fetch(`/api/patterns/qa-examples?isVerified=${isVerified}&limit=100`);
      const data = await res.json();
      setQAExamples(data.examples || []);
      setQACounts(data.counts || { verified: 0, unverified: 0, good: 0, bad: 0 });
    } catch (error) {
      console.error('Failed to fetch Q&A examples:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (activeTab === 'patterns') {
      fetchPatterns();
    } else {
      fetchQAExamples();
    }
  }, [activeTab, fetchPatterns, fetchQAExamples]);

  const handleVerifyPattern = async (id: string, verified: boolean) => {
    try {
      await fetch(`/api/patterns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVerified: verified }),
      });
      fetchPatterns();
    } catch (error) {
      console.error('Failed to update pattern:', error);
    }
  };

  const handleDeletePattern = (id: string) => {
    setConfirmDeletePatternId(id);
  };

  const confirmDeletePattern = async () => {
    if (!confirmDeletePatternId) return;
    const id = confirmDeletePatternId;
    setConfirmDeletePatternId(null);
    try {
      await fetch(`/api/patterns/${id}`, { method: 'DELETE' });
      fetchPatterns();
    } catch (error) {
      console.error('Failed to delete pattern:', error);
    }
  };

  const handleVerifyQA = async (id: string, verified: boolean) => {
    try {
      await fetch(`/api/patterns/qa-examples/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVerified: verified }),
      });
      fetchQAExamples();
    } catch (error) {
      console.error('Failed to update Q&A:', error);
    }
  };

  const handleDeleteQA = (id: string) => {
    setConfirmDeleteQAId(id);
  };

  const confirmDeleteQA = async () => {
    if (!confirmDeleteQAId) return;
    const id = confirmDeleteQAId;
    setConfirmDeleteQAId(null);
    try {
      await fetch(`/api/patterns/qa-examples/${id}`, { method: 'DELETE' });
      fetchQAExamples();
    } catch (error) {
      console.error('Failed to delete Q&A:', error);
    }
  };

  const runExtraction = async () => {
    setExtracting(true);
    try {
      const res = await fetch('/api/patterns/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50, consolidate: true }),
      });
      const data = await res.json();
      setAlertMsg(`Extraction complete!\n\nProcessed: ${data.extraction.processed} interviews\nPatterns: ${data.extraction.patternsExtracted}\nQ&A Examples: ${data.extraction.qaExtracted}\nMerged: ${data.consolidation.merged}`);
      fetchPatterns();
    } catch (error) {
      console.error('Extraction failed:', error);
      setAlertMsg('Extraction failed. Check console for details.');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <SparklesIcon className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pattern Library</h1>
            <p className="text-sm text-gray-500">Review and verify AI-extracted hiring patterns</p>
          </div>
        </div>
        <button
          onClick={runExtraction}
          disabled={extracting}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowPathIcon className={`h-4 w-4 ${extracting ? 'animate-spin' : ''}`} />
          {extracting ? 'Extracting...' : 'Run Extraction'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('patterns')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'patterns'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Patterns ({counts.verified + counts.unverified})
        </button>
        <button
          onClick={() => setActiveTab('qa')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'qa'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Q&A Examples ({qaCounts.verified + qaCounts.unverified})
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">Filter:</span>
        </div>
        <div className="flex gap-2">
          {['unverified', 'verified', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as typeof filter)}
              className={`px-3 py-1 text-sm rounded-full ${
                filter === f
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {activeTab === 'patterns' && (
                <span className="ml-1 text-xs opacity-75">
                  ({f === 'verified' ? counts.verified : f === 'unverified' ? counts.unverified : counts.verified + counts.unverified})
                </span>
              )}
              {activeTab === 'qa' && (
                <span className="ml-1 text-xs opacity-75">
                  ({f === 'verified' ? qaCounts.verified : f === 'unverified' ? qaCounts.unverified : qaCounts.verified + qaCounts.unverified})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin" />
        </div>
      ) : activeTab === 'patterns' ? (
        <div className="space-y-4">
          {patterns.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No patterns found. Run extraction to discover patterns from interview transcripts.
            </div>
          ) : (
            patterns.map((pattern) => {
              const Icon = PATTERN_TYPE_ICONS[pattern.patternType] || SparklesIcon;
              return (
                <div
                  key={pattern.id}
                  className={`bg-white rounded-lg border p-4 ${
                    pattern.isVerified ? 'border-success-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`h-4 w-4 ${pattern.positiveSignal ? 'text-success-600' : 'text-danger-600'}`} />
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          pattern.positiveSignal
                            ? 'bg-success-100 text-success-700'
                            : 'bg-danger-100 text-danger-700'
                        }`}>
                          {pattern.positiveSignal ? 'Positive' : 'Red Flag'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {PATTERN_TYPE_LABELS[pattern.patternType] || pattern.patternType}
                        </span>
                        {pattern.job && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {pattern.job.title}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          Confidence: {Math.round(pattern.confidence * 100)}%
                        </span>
                        <span className="text-xs text-gray-400">
                          Examples: {pattern.exampleCount}
                        </span>
                      </div>
                      <p className="text-gray-900 font-medium">{pattern.pattern}</p>
                      {pattern.context && (
                        <p className="text-sm text-gray-500 mt-1">{pattern.context}</p>
                      )}
                      {pattern.isVerified && pattern.verifiedBy && (
                        <p className="text-xs text-success-600 mt-2">
                          Verified by {pattern.verifiedBy.firstName} {pattern.verifiedBy.lastName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!pattern.isVerified ? (
                        <>
                          <button
                            onClick={() => handleVerifyPattern(pattern.id, true)}
                            className="p-2 text-success-600 hover:bg-success-50 rounded-lg"
                            title="Verify"
                          >
                            <CheckIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeletePattern(pattern.id)}
                            className="p-2 text-danger-600 hover:bg-danger-50 rounded-lg"
                            title="Delete"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleVerifyPattern(pattern.id, false)}
                          className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
                          title="Unverify"
                        >
                          <XCircleIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {qaExamples.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No Q&A examples found. Run extraction to discover examples from interview transcripts.
            </div>
          ) : (
            qaExamples.map((qa) => (
              <div
                key={qa.id}
                className={`bg-white rounded-lg border p-4 ${
                  qa.isVerified ? 'border-success-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        qa.isGoodExample
                          ? 'bg-success-100 text-success-700'
                          : 'bg-warning-100 text-warning-700'
                      }`}>
                        {qa.isGoodExample ? 'Good Example' : 'Bad Example'}
                      </span>
                      {qa.qualityScore && (
                        <span className="text-xs text-gray-500">
                          Quality: {qa.qualityScore}/5
                        </span>
                      )}
                      {qa.job && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {qa.job.title}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase">Question</span>
                        <p className="text-gray-900">{qa.question}</p>
                        {qa.questionIntent && (
                          <p className="text-xs text-gray-500 italic">Intent: {qa.questionIntent}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase">Answer</span>
                        <p className="text-gray-700">{qa.exampleAnswer}</p>
                      </div>
                      {qa.explanation && (
                        <div>
                          <span className="text-xs font-medium text-gray-500 uppercase">Why {qa.isGoodExample ? 'Good' : 'Bad'}</span>
                          <p className="text-sm text-gray-600">{qa.explanation}</p>
                        </div>
                      )}
                    </div>
                    {qa.isVerified && qa.verifiedBy && (
                      <p className="text-xs text-success-600 mt-2">
                        Verified by {qa.verifiedBy.firstName} {qa.verifiedBy.lastName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!qa.isVerified ? (
                      <>
                        <button
                          onClick={() => handleVerifyQA(qa.id, true)}
                          className="p-2 text-success-600 hover:bg-success-50 rounded-lg"
                          title="Verify"
                        >
                          <CheckIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQA(qa.id)}
                          className="p-2 text-danger-600 hover:bg-danger-50 rounded-lg"
                          title="Delete"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleVerifyQA(qa.id, false)}
                        className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
                        title="Unverify"
                      >
                        <XCircleIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <AlertModal open={!!alertMsg} onClose={() => setAlertMsg(null)} title="Notice" message={alertMsg || ""} />
      <ConfirmModal
        open={!!confirmDeletePatternId}
        onClose={() => setConfirmDeletePatternId(null)}
        onConfirm={confirmDeletePattern}
        title="Delete Pattern"
        message="Delete this pattern?"
        confirmLabel="Delete"
        variant="danger"
      />
      <ConfirmModal
        open={!!confirmDeleteQAId}
        onClose={() => setConfirmDeleteQAId(null)}
        onConfirm={confirmDeleteQA}
        title="Delete Q&A Example"
        message="Delete this Q&A example?"
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
