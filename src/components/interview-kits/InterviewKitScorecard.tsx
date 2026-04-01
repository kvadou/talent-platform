'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircleIcon,
  SparklesIcon,
  XCircleIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  MinusCircleIcon,
  StarIcon as StarOutlineIcon,
  InformationCircleIcon,
  LockClosedIcon,
  UserGroupIcon,
  AtSymbolIcon,
} from '@heroicons/react/24/outline';
import { AIFeedbackModal } from './AIFeedbackModal';
import { Modal } from '@/components/ui/Modal';
import { StarIcon } from '@heroicons/react/24/solid';

interface Attribute {
  id: string;
  name: string;
  description: string | null;
  required: boolean;
  order: number;
}

interface Category {
  id: string;
  name: string;
  order: number;
  attributes: Attribute[];
}

interface InterviewKit {
  id: string;
  name: string;
  type: string;
  duration: number;
  includesAudition: boolean;
  categories: Category[];
}

interface Rating {
  attributeId: string;
  rating: number;
  notes: string;
  aiSuggested: number | null;
}

interface ExistingScorecard {
  id: string;
  keyTakeaways: string | null;
  privateNotes: string | null;
  otherInterviewerNotes: string | null;
  overallRecommendation: string;
  ratings: Array<{
    attributeId: string;
    rating: number;
    notes: string | null;
    aiSuggested: number | null;
  }>;
}

interface AttributeAnalysisItem {
  attributeId: string;
  attributeName: string;
  suggestedRating: number;
  evidence: string[];
  confidence: 'high' | 'medium' | 'low';
}

interface AISummary {
  id: string;
  summary: string;
  attributeAnalysis: AttributeAnalysisItem[] | Record<string, { score: number; evidence: string }>;
  recommendation: string;
  recommendationScore: number;
  recommendationReason: string;
  strengths: string[];
  concerns: string[];
  followUpQuestions: string[];
}

interface Props {
  interviewId: string;
  kit: InterviewKit;
  existingScorecard: ExistingScorecard | null;
  aiSummary: AISummary | null;
  onSubmit: () => void;
  interviewerName?: string;
  isUpcoming?: boolean;
}

const RECOMMENDATIONS = [
  { value: 'STRONG_NO', label: 'Hard No', icon: XCircleIcon },
  { value: 'NO', label: 'No', icon: HandThumbDownIcon },
  { value: 'YES', label: 'Yes', icon: HandThumbUpIcon },
  { value: 'STRONG_YES', label: 'Strong Yes', icon: StarOutlineIcon },
];

// Rating options matching Greenhouse style (1-5 scale with icons)
const RATING_OPTIONS = [
  { value: 1, icon: XCircleIcon, label: 'Hard No', color: 'text-danger-500', hoverColor: 'hover:text-danger-600', bgColor: 'bg-danger-50' },
  { value: 2, icon: HandThumbDownIcon, label: 'No', color: 'text-warning-500', hoverColor: 'hover:text-warning-600', bgColor: 'bg-warning-50' },
  { value: 3, icon: MinusCircleIcon, label: 'Mixed', color: 'text-gray-400', hoverColor: 'hover:text-gray-500', bgColor: 'bg-gray-50' },
  { value: 4, icon: HandThumbUpIcon, label: 'Yes', color: 'text-success-500', hoverColor: 'hover:text-success-600', bgColor: 'bg-success-50' },
  { value: 5, icon: StarOutlineIcon, label: 'Strong Yes', color: 'text-yellow-500', hoverColor: 'hover:text-yellow-600', bgColor: 'bg-yellow-50' },
];

type RefineAction = 'refine' | 'grammar' | 'concise' | 'detailed';

// Full-featured Rich Text Editor Component
function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 240,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const aiMenuRef = useRef<HTMLDivElement>(null);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const insertLink = () => {
    setLinkUrl('');
    setShowLinkPrompt(true);
  };

  const handleLinkSubmit = (url: string) => {
    setShowLinkPrompt(false);
    if (url) {
      execCommand('createLink', url);
    }
  };

  const handleRefineWithAI = async (action: RefineAction) => {
    setShowAIMenu(false);
    setRefineError(null);

    const text = editorRef.current?.innerText?.trim();
    if (!text || text.length < 10) {
      setRefineError('Please enter at least 10 characters before using AI refinement.');
      return;
    }

    setIsRefining(true);
    try {
      const res = await fetch('/api/ai/refine-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, action }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to refine text');
      }

      const { refinedText } = await res.json();

      if (editorRef.current) {
        editorRef.current.innerHTML = refinedText;
        onChange(refinedText);
      }
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : 'Failed to refine text');
    } finally {
      setIsRefining(false);
    }
  };

  // Close AI menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(event.target as Node)) {
        setShowAIMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  // Toolbar button component for consistency
  const ToolbarButton = ({ onClick, title, children, className = '' }: { onClick: () => void; title: string; children: React.ReactNode; className?: string }) => (
    <button
      type="button"
      onClick={onClick}
      className={`p-1.5 rounded hover:bg-gray-200 text-gray-600 ${className}`}
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 relative">
      {/* Loading Overlay */}
      {isRefining && (
        <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
          <div className="flex items-center gap-2 text-purple-600">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-medium">Refining with AI...</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {refineError && (
        <div className="bg-danger-50 border-b border-danger-200 px-3 py-2 text-sm text-danger-600 flex items-center justify-between">
          <span>{refineError}</span>
          <button onClick={() => setRefineError(null)} className="text-danger-400 hover:text-danger-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        {/* Bold */}
        <ToolbarButton onClick={() => execCommand('bold')} title="Bold (Ctrl+B)">
          <span className="font-bold text-sm w-5 h-5 flex items-center justify-center">B</span>
        </ToolbarButton>

        {/* Italic */}
        <ToolbarButton onClick={() => execCommand('italic')} title="Italic (Ctrl+I)">
          <span className="italic text-sm w-5 h-5 flex items-center justify-center">I</span>
        </ToolbarButton>

        {/* Strikethrough */}
        <ToolbarButton onClick={() => execCommand('strikeThrough')} title="Strikethrough">
          <span className="line-through text-sm w-5 h-5 flex items-center justify-center">S</span>
        </ToolbarButton>

        {/* Link */}
        <ToolbarButton onClick={insertLink} title="Insert Link">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </ToolbarButton>

        <span className="w-px h-5 bg-gray-300 mx-1.5" />

        {/* Clear Formatting */}
        <ToolbarButton onClick={() => execCommand('removeFormat')} title="Clear Formatting">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h8m-4-8v16M10 4h4m-2 0L8 20m2-16h4" />
            <line x1="4" y1="4" x2="20" y2="20" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </ToolbarButton>

        {/* Quote / Blockquote */}
        <ToolbarButton onClick={() => execCommand('formatBlock', 'blockquote')} title="Quote">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
          </svg>
        </ToolbarButton>

        {/* Code */}
        <ToolbarButton onClick={() => execCommand('formatBlock', 'pre')} title="Code Block">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </ToolbarButton>

        <span className="w-px h-5 bg-gray-300 mx-1.5" />

        {/* Unordered List */}
        <ToolbarButton onClick={() => execCommand('insertUnorderedList')} title="Bullet List">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            <circle cx="2" cy="6" r="1" fill="currentColor" />
            <circle cx="2" cy="12" r="1" fill="currentColor" />
            <circle cx="2" cy="18" r="1" fill="currentColor" />
          </svg>
        </ToolbarButton>

        {/* Ordered List */}
        <ToolbarButton onClick={() => execCommand('insertOrderedList')} title="Numbered List">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13" />
            <text x="2" y="8" fontSize="6" fill="currentColor" fontWeight="bold">1</text>
            <text x="2" y="14" fontSize="6" fill="currentColor" fontWeight="bold">2</text>
            <text x="2" y="20" fontSize="6" fill="currentColor" fontWeight="bold">3</text>
          </svg>
        </ToolbarButton>

        <span className="w-px h-5 bg-gray-300 mx-1.5" />

        {/* Decrease Indent */}
        <ToolbarButton onClick={() => execCommand('outdent')} title="Decrease Indent">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 6h10M11 12h10M11 18h10M7 12l-4-4m0 0l4-4m-4 4h4" />
          </svg>
        </ToolbarButton>

        {/* Increase Indent */}
        <ToolbarButton onClick={() => execCommand('indent')} title="Increase Indent">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 6h10M11 12h10M11 18h10M3 8l4 4-4 4" />
          </svg>
        </ToolbarButton>

        {/* Spacer to push AI to right */}
        <div className="flex-1" />

        {/* AI Refine Button with Dropdown */}
        <div className="relative" ref={aiMenuRef}>
          <button
            type="button"
            onClick={() => setShowAIMenu(!showAIMenu)}
            className="flex items-center gap-1 p-1.5 rounded hover:bg-purple-100 text-purple-600 transition-colors"
            title="Refine with AI"
          >
            <SparklesIcon className="w-4 h-4" />
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* AI Dropdown Menu */}
          {showAIMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <button
                onClick={() => handleRefineWithAI('refine')}
                disabled={isRefining}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
              >
                <SparklesIcon className="w-4 h-4 text-purple-500" />
                Refine text with AI
              </button>
              <button
                onClick={() => handleRefineWithAI('grammar')}
                disabled={isRefining}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Fix grammar & spelling
              </button>
              <button
                onClick={() => handleRefineWithAI('concise')}
                disabled={isRefining}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
                </svg>
                Make more concise
              </button>
              <button
                onClick={() => handleRefineWithAI('detailed')}
                disabled={isRefining}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Make more detailed
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="p-3 text-sm text-gray-700 focus:outline-none prose prose-sm max-w-none resize-y overflow-auto"
        data-placeholder={placeholder}
        style={{
          minHeight: `${minHeight}px`,
          maxHeight: '600px',
        }}
      />

      {/* Placeholder styling */}
      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contenteditable] blockquote {
          border-left: 3px solid #e5e7eb;
          padding-left: 1rem;
          margin-left: 0;
          color: #6b7280;
          font-style: italic;
        }
        [contenteditable] pre {
          background: #f3f4f6;
          padding: 0.75rem;
          border-radius: 0.375rem;
          font-family: monospace;
          font-size: 0.875rem;
        }
      `}</style>

      <Modal open={showLinkPrompt} onClose={() => setShowLinkPrompt(false)} title="Insert Link">
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Enter URL..."
          onKeyDown={(e) => e.key === 'Enter' && handleLinkSubmit(linkUrl)}
          autoFocus
        />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setShowLinkPrompt(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={() => handleLinkSubmit(linkUrl)} className="px-4 py-2 text-white bg-purple-700 rounded-lg hover:bg-purple-800">Insert Link</button>
        </div>
      </Modal>
    </div>
  );
}

export function InterviewKitScorecard({
  interviewId,
  kit,
  existingScorecard,
  aiSummary,
  onSubmit,
  interviewerName = 'Current User',
  isUpcoming = false,
}: Props) {
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [keyTakeaways, setKeyTakeaways] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [otherInterviewerNotes, setOtherInterviewerNotes] = useState('');
  const [overallRecommendation, setOverallRecommendation] = useState<string | null>(null);
  const [showPrivateNotes, setShowPrivateNotes] = useState(false);
  const [showOtherNotes, setShowOtherNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAISuggestions, setShowAISuggestions] = useState(!!aiSummary);
  const [interviewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showAIFeedbackModal, setShowAIFeedbackModal] = useState(false);

  // Initialize from existing scorecard
  useEffect(() => {
    if (existingScorecard) {
      setKeyTakeaways(existingScorecard.keyTakeaways || '');
      setPrivateNotes(existingScorecard.privateNotes || '');
      setOtherInterviewerNotes(existingScorecard.otherInterviewerNotes || '');
      setOverallRecommendation(existingScorecard.overallRecommendation);

      if (existingScorecard.privateNotes) setShowPrivateNotes(true);
      if (existingScorecard.otherInterviewerNotes) setShowOtherNotes(true);

      const ratingsMap: Record<string, Rating> = {};
      existingScorecard.ratings.forEach((r) => {
        ratingsMap[r.attributeId] = {
          attributeId: r.attributeId,
          rating: r.rating,
          notes: r.notes || '',
          aiSuggested: r.aiSuggested,
        };
      });
      setRatings(ratingsMap);
    }
  }, [existingScorecard, kit]);

  // Auto-save draft on changes (debounced)
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const hasInitialized = useRef(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const autoSave = useCallback(async () => {
    // Only auto-save if there's something to save
    if (!keyTakeaways && !privateNotes && !otherInterviewerNotes && Object.keys(ratings).length === 0 && !overallRecommendation) return;

    try {
      setAutoSaveStatus('saving');
      const ratingsArray = Object.values(ratings).filter((r) => r.rating > 0);
      await fetch(`/api/interviews/${interviewId}/scorecard`, {
        method: existingScorecard ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyTakeaways,
          privateNotes,
          otherInterviewerNotes,
          overallRecommendation: overallRecommendation || 'NO',
          ratings: ratingsArray,
          isDraft: true,
        }),
      });
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch {
      setAutoSaveStatus('idle');
    }
  }, [keyTakeaways, privateNotes, otherInterviewerNotes, ratings, overallRecommendation, interviewId, existingScorecard]);

  useEffect(() => {
    // Skip auto-save during initial load
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      return;
    }

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(autoSave, 2000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [keyTakeaways, privateNotes, otherInterviewerNotes, ratings, overallRecommendation, autoSave]);

  // Helper to get AI analysis for an attribute
  const getAIAnalysis = (attributeId: string): { score: number; evidence: string } | null => {
    if (!aiSummary?.attributeAnalysis) return null;

    // Handle array format (new)
    if (Array.isArray(aiSummary.attributeAnalysis)) {
      const item = aiSummary.attributeAnalysis.find(
        (a) => a.attributeId === attributeId
      );
      if (item) {
        return {
          score: item.suggestedRating,
          evidence: item.evidence.join('\n'),
        };
      }
      return null;
    }

    // Handle record format (legacy)
    return aiSummary.attributeAnalysis[attributeId] || null;
  };

  // Apply AI suggestions
  const applyAISuggestions = () => {
    if (!aiSummary?.attributeAnalysis) return;

    const newRatings = { ...ratings };
    kit.categories.forEach((category) => {
      category.attributes.forEach((attr) => {
        const analysis = getAIAnalysis(attr.id);
        if (analysis && !newRatings[attr.id]?.rating) {
          newRatings[attr.id] = {
            attributeId: attr.id,
            rating: analysis.score,
            notes: analysis.evidence || '',
            aiSuggested: analysis.score,
          };
        }
      });
    });
    setRatings(newRatings);
  };

  const setRating = (attributeId: string, rating: number) => {
    setRatings((prev) => ({
      ...prev,
      [attributeId]: {
        ...prev[attributeId],
        attributeId,
        rating: prev[attributeId]?.rating === rating ? 0 : rating, // Toggle off if same rating clicked
        notes: prev[attributeId]?.notes || '',
        aiSuggested: prev[attributeId]?.aiSuggested || null,
      },
    }));
  };

  const isFormValid = (): boolean => {
    return !!overallRecommendation;
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      setError('Please provide an overall recommendation.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const ratingsArray = Object.values(ratings).filter((r) => r.rating > 0);

      const res = await fetch(`/api/interviews/${interviewId}/scorecard`, {
        method: existingScorecard ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyTakeaways,
          privateNotes,
          otherInterviewerNotes,
          overallRecommendation,
          ratings: ratingsArray,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save scorecard');
      }

      // Show AI feedback modal if AI summary exists, otherwise complete directly
      if (aiSummary) {
        setShowAIFeedbackModal(true);
      } else {
        onSubmit();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save scorecard');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bias Reminder */}
      <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <InformationCircleIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-600">
          <span className="font-medium">Remember to focus on job-relevant qualifications</span> and support your judgments with objective examples. This reduces bias and helps us hire the best candidates.
        </div>
      </div>

      {/* AI Suggestions Banner */}
      {aiSummary && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SparklesIcon className="h-5 w-5 text-purple-600" />
              <div>
                <p className="font-medium text-purple-900">AI Analysis Available</p>
                <p className="text-sm text-purple-700">
                  AI has analyzed the interview and suggested ratings.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-purple-700">
                <input
                  type="checkbox"
                  checked={showAISuggestions}
                  onChange={(e) => setShowAISuggestions(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                Show suggestions
              </label>
              <button
                onClick={applyAISuggestions}
                className="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                Apply AI Suggestions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Key Take-Aways Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-gray-900">Key Take-Aways</h2>
            <button className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1">
              <AtSymbolIcon className="h-4 w-4" />
              Mention Others
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Conclusions, pros, cons, and things to follow up on
          </p>

          <RichTextEditor
            value={keyTakeaways}
            onChange={setKeyTakeaways}
            placeholder="Enter your key takeaways from the interview..."
          />

          {/* Private Notes / Other Interviewer Notes */}
          <div className="flex items-center gap-4 mt-3 text-sm">
            <button
              onClick={() => setShowPrivateNotes(!showPrivateNotes)}
              className={`flex items-center gap-1.5 ${showPrivateNotes ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LockClosedIcon className="h-4 w-4" />
              Private Notes
            </button>
            <span className="text-gray-300">|</span>
            <span className="text-gray-500">Add:</span>
            <button
              onClick={() => setShowOtherNotes(!showOtherNotes)}
              className={`flex items-center gap-1.5 ${showOtherNotes ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <UserGroupIcon className="h-4 w-4" />
              Note for Other Interviewers
            </button>
          </div>

          {/* Private Notes Textarea */}
          {showPrivateNotes && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <LockClosedIcon className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Private Notes</span>
                <span className="text-xs text-gray-500">(Only visible to you)</span>
              </div>
              <textarea
                value={privateNotes}
                onChange={(e) => setPrivateNotes(e.target.value)}
                placeholder="Personal notes that won't be shared..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none bg-white"
                rows={3}
              />
            </div>
          )}

          {/* Note for Other Interviewers */}
          {showOtherNotes && (
            <div className="mt-4 p-4 bg-cyan-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <UserGroupIcon className="h-4 w-4 text-cyan-500" />
                <span className="text-sm font-medium text-cyan-700">Note for Other Interviewers</span>
              </div>
              <textarea
                value={otherInterviewerNotes}
                onChange={(e) => setOtherInterviewerNotes(e.target.value)}
                placeholder="Share context or questions for other interviewers..."
                className="w-full px-3 py-2 text-sm border border-cyan-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-none bg-white"
                rows={3}
              />
            </div>
          )}
        </div>
      </div>

      {/* Attributes Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Attributes</h2>
          <p className="text-sm text-gray-500 mt-1">
            Does the candidate show clear competence in the following areas?
          </p>
        </div>

        {/* Optional Fields Reminder */}
        <div className="mx-6 mt-4 p-3 bg-warning-50 border-l-4 border-warning-400 rounded-r-lg">
          <p className="text-sm text-warning-800">
            <span className="font-medium">Remember, all fields are optional!</span> Only rate attributes you have a clear opinion on.
          </p>
        </div>

        {/* Categories and Attributes */}
        <div className="divide-y divide-gray-100">
          {kit.categories.map((category) => (
            <div key={category.id} className="px-6 py-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">{category.name}</h3>

              <div className="space-y-4">
                {category.attributes.map((attr) => {
                  const rating = ratings[attr.id];
                  const aiAnalysis = getAIAnalysis(attr.id);

                  return (
                    <div key={attr.id} className="flex items-start justify-between py-2">
                      <div className="flex-1 mr-4">
                        <span className="text-sm text-gray-700">{attr.name}</span>
                        {attr.description && (
                          <p className="text-xs text-gray-400 mt-0.5">{attr.description}</p>
                        )}
                        {/* AI Suggestion inline */}
                        {showAISuggestions && aiAnalysis && (
                          <div className="mt-2 p-2 bg-purple-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <SparklesIcon className="h-3 w-3 text-purple-500 flex-shrink-0" />
                              <span className="text-xs font-medium text-purple-700">
                                AI suggests: {RATING_OPTIONS[aiAnalysis.score - 1]?.label}
                              </span>
                            </div>
                            {aiAnalysis.evidence && (
                              <p className="text-xs text-purple-600 mt-1 line-clamp-2">
                                {aiAnalysis.evidence}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Rating Icons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {RATING_OPTIONS.map((option) => {
                          const Icon = option.icon;
                          const isSelected = rating?.rating === option.value;
                          const isAISuggested = showAISuggestions && aiAnalysis?.score === option.value;

                          return (
                            <button
                              key={option.value}
                              onClick={() => setRating(attr.id, option.value)}
                              className={`p-1.5 rounded-full transition-all relative ${
                                isSelected
                                  ? `${option.bgColor} ${option.color}`
                                  : isAISuggested
                                  ? 'text-purple-400 hover:text-purple-500 ring-2 ring-purple-200'
                                  : 'text-gray-300 hover:text-gray-400'
                              }`}
                              title={option.label}
                            >
                              <Icon className="h-5 w-5" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overall Recommendation */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Overall Recommendation</h2>
        <p className="text-sm text-gray-500 mb-4">Did the candidate pass the interview?</p>

        <div className="grid grid-cols-4 gap-2 mb-6">
          {RECOMMENDATIONS.map((rec) => {
            const isSelected = overallRecommendation === rec.value;
            const RecIcon = rec.icon;
            return (
              <button
                key={rec.value}
                onClick={() => setOverallRecommendation(rec.value)}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all border-2 ${
                  isSelected
                    ? rec.value.includes('NO')
                      ? 'border-danger-500 bg-danger-50 text-danger-700'
                      : 'border-success-500 bg-success-50 text-success-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <RecIcon className="w-5 h-5" />
                {rec.label}
              </button>
            );
          })}
        </div>

        {/* Interviewer and Date */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Interviewed by</span>
              <span className="font-medium text-gray-900">{interviewerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">on</span>
              <span className="font-medium text-gray-900">{interviewDate}</span>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving || !isFormValid()}
            className="px-4 py-2 bg-success-600 text-white font-medium text-sm rounded-lg hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Submit Scorecard'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Existing Scorecard Indicator */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {autoSaveStatus === 'saving' && 'Auto-saving...'}
          {autoSaveStatus === 'saved' && '✓ Draft saved'}
        </span>
        {existingScorecard && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CheckCircleIcon className="h-5 w-5 text-success-500" />
            Scorecard previously submitted - editing will update it
          </div>
        )}
      </div>

      {/* AI Feedback Modal */}
      {showAIFeedbackModal && aiSummary && overallRecommendation && (
        <AIFeedbackModal
          interviewId={interviewId}
          aiSummary={{
            recommendation: aiSummary.recommendation,
            recommendationScore: aiSummary.recommendationScore,
            strengths: aiSummary.strengths,
            concerns: aiSummary.concerns,
          }}
          humanRecommendation={overallRecommendation}
          onClose={() => {
            setShowAIFeedbackModal(false);
            onSubmit();
          }}
          onComplete={() => {
            setShowAIFeedbackModal(false);
            onSubmit();
          }}
        />
      )}
    </div>
  );
}
