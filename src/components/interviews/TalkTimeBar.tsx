'use client';

interface TalkTimeBarProps {
  interviewerPercent: number;
  candidatePercent: number;
  interviewerSeconds: number;
  candidateSeconds: number;
  isBalanced: boolean;
  compact?: boolean;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function getBalanceRing(interviewerPercent: number): { ring: string; label: string } {
  if (interviewerPercent >= 25 && interviewerPercent <= 50) {
    return { ring: 'ring-green-400', label: 'Balanced' };
  }
  if (
    (interviewerPercent > 50 && interviewerPercent <= 55) ||
    (interviewerPercent >= 20 && interviewerPercent < 25)
  ) {
    return { ring: 'ring-amber-400', label: 'Slightly off balance' };
  }
  return { ring: 'ring-red-400', label: 'Imbalanced' };
}

export function TalkTimeBar({
  interviewerPercent,
  candidatePercent,
  interviewerSeconds,
  candidateSeconds,
  isBalanced,
  compact = false,
}: TalkTimeBarProps) {
  const { ring, label } = getBalanceRing(interviewerPercent);

  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Interviewer {interviewerPercent}% ({formatDuration(interviewerSeconds)})</span>
          <span>Candidate {candidatePercent}% ({formatDuration(candidateSeconds)})</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-gray-700">
          {interviewerPercent > 0 && (
            <div
              className="bg-purple-500 transition-all duration-300"
              style={{ width: `${interviewerPercent}%` }}
            />
          )}
          {candidatePercent > 0 && (
            <div
              className="bg-cyan-500 transition-all duration-300"
              style={{ width: `${candidatePercent}%` }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-4 bg-white border border-gray-200 ring-2 ${ring}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-sm font-medium text-gray-700">
            Interviewer {interviewerPercent}%
          </span>
          <span className="text-xs text-gray-400">({formatDuration(interviewerSeconds)})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">({formatDuration(candidateSeconds)})</span>
          <span className="text-sm font-medium text-gray-700">
            Candidate {candidatePercent}%
          </span>
          <div className="w-3 h-3 rounded-full bg-cyan-500" />
        </div>
      </div>
      <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
        {interviewerPercent > 0 && (
          <div
            className="bg-purple-500 transition-all duration-300"
            style={{ width: `${interviewerPercent}%` }}
          />
        )}
        {candidatePercent > 0 && (
          <div
            className="bg-cyan-500 transition-all duration-300"
            style={{ width: `${candidatePercent}%` }}
          />
        )}
      </div>
      <div className="mt-2 text-center">
        <span className={`text-xs font-medium ${isBalanced ? 'text-success-600' : 'text-warning-600'}`}>
          {label}
        </span>
      </div>
    </div>
  );
}
