'use client';

import { useState, useEffect, useRef } from 'react';
import {
  MagnifyingGlassIcon,
  UserIcon,
  ChatBubbleLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { TranscriptSegment } from '@/lib/whisper';

interface InterviewTranscriptViewerProps {
  segments: TranscriptSegment[];
  currentTime?: number;
  onSeek?: (time: number) => void;
  isPlaying?: boolean;
}

export function InterviewTranscriptViewer({
  segments,
  currentTime = 0,
  onSeek,
  isPlaying = false,
}: InterviewTranscriptViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  // Find the currently active segment based on playback time
  const activeSegmentIndex = segments.findIndex(
    (seg, idx) => {
      const nextSeg = segments[idx + 1];
      return currentTime >= seg.start && (nextSeg ? currentTime < nextSeg.start : true);
    }
  );

  // Filter segments by search query
  const filteredSegments = searchQuery
    ? segments.filter((seg) =>
        seg.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : segments;

  // Auto-scroll to active segment when playing
  useEffect(() => {
    if (autoScroll && isPlaying && activeSegmentRef.current && containerRef.current) {
      const container = containerRef.current;
      const element = activeSegmentRef.current;
      const elementTop = element.offsetTop;
      const elementHeight = element.offsetHeight;
      const containerTop = container.scrollTop;
      const containerHeight = container.clientHeight;

      // Only scroll if element is outside visible area
      if (elementTop < containerTop || elementTop + elementHeight > containerTop + containerHeight) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeSegmentIndex, autoScroll, isPlaying]);

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSegmentClick = (segment: TranscriptSegment) => {
    onSeek?.(segment.start);
  };

  const toggleSegmentExpand = (index: number) => {
    const newExpanded = new Set(expandedSegments);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSegments(newExpanded);
  };

  const highlightSearchTerm = (text: string, query: string): React.ReactNode => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (segments.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center">
        <ChatBubbleLeftIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No transcript available</p>
        <p className="text-gray-400 text-sm mt-1">
          Transcript will appear here after the recording is processed
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search and Controls */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
          />
          {searchQuery && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {filteredSegments.length} results
            </span>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
          />
          Auto-scroll
        </label>
      </div>

      {/* Transcript Segments */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto py-4 space-y-1"
      >
        {filteredSegments.map((segment, index) => {
          const originalIndex = segments.indexOf(segment);
          const isActive = originalIndex === activeSegmentIndex;
          const isExpanded = expandedSegments.has(originalIndex);
          const isLongText = segment.text.length > 200;
          const displayText = isLongText && !isExpanded
            ? segment.text.slice(0, 200) + '...'
            : segment.text;

          return (
            <div
              key={originalIndex}
              ref={isActive ? activeSegmentRef : null}
              className={`group rounded-lg p-3 transition-all cursor-pointer ${
                isActive
                  ? 'bg-cyan-50 border border-cyan-200'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
              onClick={() => handleSegmentClick(segment)}
            >
              <div className="flex items-start gap-3">
                {/* Speaker Icon */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    segment.speaker === 'interviewer'
                      ? 'bg-purple-100 text-purple-600'
                      : segment.speaker === 'candidate'
                      ? 'bg-success-100 text-success-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <UserIcon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-sm font-medium ${
                        segment.speaker === 'interviewer'
                          ? 'text-purple-700'
                          : segment.speaker === 'candidate'
                          ? 'text-success-700'
                          : 'text-gray-600'
                      }`}
                    >
                      {segment.speaker === 'interviewer'
                        ? 'Interviewer'
                        : segment.speaker === 'candidate'
                        ? 'Candidate'
                        : 'Unknown'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSegmentClick(segment);
                      }}
                      className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                        isActive
                          ? 'bg-cyan-200 text-cyan-700'
                          : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                      }`}
                    >
                      {formatTimestamp(segment.start)}
                    </button>
                  </div>

                  <p className="text-gray-700 text-sm leading-relaxed">
                    {highlightSearchTerm(displayText, searchQuery)}
                  </p>

                  {isLongText && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSegmentExpand(originalIndex);
                      }}
                      className="mt-1 text-xs text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUpIcon className="w-3 h-3" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDownIcon className="w-3 h-3" />
                          Show more
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Duration badge */}
                <span className="flex-shrink-0 text-xs text-gray-400">
                  {Math.round(segment.end - segment.start)}s
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="pt-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            Interviewer: {segments.filter((s) => s.speaker === 'interviewer').length} segments
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success-400" />
            Candidate: {segments.filter((s) => s.speaker === 'candidate').length} segments
          </span>
        </div>
        <span>
          {segments.length} total segments
        </span>
      </div>
    </div>
  );
}
