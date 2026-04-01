'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, DocumentTextIcon, ArrowTopRightOnSquareIcon, CheckCircleIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { ApplicationData } from '../ApplicationDetailPage';

type Answer = {
  id: string;
  value: string;
  question: {
    id: string;
    label: string;
    type: string;
  };
};

type Props = {
  application: ApplicationData;
  answers: Answer[];
};

function ScoreBar({ label, score, maxScore = 100 }: { label: string; score: number; maxScore?: number }) {
  const percentage = (score / maxScore) * 100;
  const color = percentage >= 70 ? 'bg-success-500' : percentage >= 40 ? 'bg-yellow-500' : 'bg-danger-400';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{score}/{maxScore}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export function ApplicationDetailsPanel({ application, answers }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['questions']));

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <h3 className="font-semibold text-gray-900">Application details</h3>

      {/* AI Score Section */}
      {application.aiScoreBreakdown && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <SparklesIcon className="w-5 h-5 text-purple-600" />
            <h4 className="font-medium text-gray-900">AI Score</h4>
            <span className={`ml-auto px-2 py-0.5 rounded text-sm font-bold ${
              application.aiScore && application.aiScore >= 70
                ? 'bg-success-100 text-success-700'
                : application.aiScore && application.aiScore >= 40
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {application.aiScore}%
            </span>
          </div>
          <div className="space-y-3">
            <ScoreBar label="Resume Fit" score={application.aiScoreBreakdown.resumeFit} />
            <ScoreBar label="Answer Quality" score={application.aiScoreBreakdown.answerQuality} />
            <ScoreBar label="Completeness" score={application.aiScoreBreakdown.answerCompleteness} />
          </div>
          {application.aiScoreBreakdown.factors && (
            <div className="mt-3 pt-3 border-t border-purple-100 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Questions answered</span>
                <span>{application.aiScoreBreakdown.factors.answeredQuestions}/{application.aiScoreBreakdown.factors.totalQuestions}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg answer length</span>
                <span>{application.aiScoreBreakdown.factors.avgAnswerLength} chars</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Basic Info */}
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-gray-500 mb-1">Application date</p>
          <p className="text-gray-900">Applied on {formatDate(application.createdAt)}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Applied through</p>
          <p className="text-gray-900">
            {application.job.title} - {application.job.market.name}
          </p>
        </div>
      </div>

      {/* Source and responsibility */}
      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={() => toggleSection('source')}
          className="flex items-center justify-between w-full text-left"
        >
          <h4 className="font-medium text-gray-900">Source and responsibility</h4>
          {expandedSections.has('source') ? (
            <ChevronUpIcon className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {expandedSections.has('source') && (
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-1">Source & referrer</p>
              <p className="text-gray-900">{application.source || 'Direct'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Application recruiter</p>
              <p className="text-gray-400">--</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Application coordinator</p>
              <p className="text-gray-400">--</p>
            </div>
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={() => toggleSection('documents')}
          className="flex items-center justify-between w-full text-left"
        >
          <h4 className="font-medium text-gray-900">Documents</h4>
          {expandedSections.has('documents') ? (
            <ChevronUpIcon className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {expandedSections.has('documents') && (
          <div className="mt-3 space-y-2">
            {application.candidate.resumeUrl ? (
              <a
                href={application.candidate.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                <DocumentTextIcon className="w-5 h-5 text-gray-400" />
                <span className="flex-1 text-sm text-gray-900">Resume</span>
                <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-400" />
              </a>
            ) : (
              <p className="text-sm text-gray-400">No documents uploaded</p>
            )}
            <button className="text-sm text-brand-purple hover:underline">
              + Attach file
            </button>
          </div>
        )}
      </div>

      {/* Application Questions */}
      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={() => toggleSection('questions')}
          className="flex items-center justify-between w-full text-left"
        >
          <h4 className="font-medium text-gray-900">Application Questions</h4>
          {expandedSections.has('questions') ? (
            <ChevronUpIcon className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {expandedSections.has('questions') && (
          <div className="mt-3">
            {answers.length === 0 ? (
              <p className="text-sm text-gray-400">No screening questions answered</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircleIcon className="w-4 h-4 text-success-500" />
                  <span>Job Post Questions</span>
                </div>
                <p className="text-xs text-gray-500">
                  Submitted by {application.candidate.firstName} on {formatDate(application.createdAt)} through{' '}
                  {application.job.title} - {application.job.market.name}
                </p>

                {answers.map((answer) => (
                  <div key={answer.id} className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-gray-600 mb-1">{answer.question.label}</p>
                    <p className="text-sm text-gray-900">{answer.value || '--'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Forms */}
      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={() => toggleSection('forms')}
          className="flex items-center justify-between w-full text-left"
        >
          <h4 className="font-medium text-gray-900">Forms</h4>
          {expandedSections.has('forms') ? (
            <ChevronUpIcon className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {expandedSections.has('forms') && (
          <div className="mt-3">
            <p className="text-sm text-gray-400">No forms submitted</p>
          </div>
        )}
      </div>

      {/* Background check */}
      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={() => toggleSection('background')}
          className="flex items-center justify-between w-full text-left"
        >
          <h4 className="font-medium text-gray-900">Background check</h4>
          {expandedSections.has('background') ? (
            <ChevronUpIcon className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {expandedSections.has('background') && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">Checkr</p>
            <p className="text-xs text-gray-500 mb-3">
              By submitting the background check order, you certify that the information requested here is lawful and relevant for employment purposes, and that the information you receive will be used for that limited purpose.
            </p>
            <button className="px-3 py-1.5 text-sm font-medium text-brand-purple border border-brand-purple rounded hover:bg-brand-purple/5 transition-colors">
              Export to Checkr
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
