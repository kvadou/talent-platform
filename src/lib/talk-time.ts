import { TranscriptSegment } from './whisper';

export interface TalkTimeStats {
  interviewerSeconds: number;
  candidateSeconds: number;
  totalSeconds: number;
  interviewerPercent: number;
  candidatePercent: number;
  silenceSeconds: number;
  longestInterviewerSegment: number;
  longestCandidateSegment: number;
  isBalanced: boolean; // true if interviewer 25-50%
}

export function computeTalkTime(segments: TranscriptSegment[]): TalkTimeStats {
  if (segments.length === 0) {
    return {
      interviewerSeconds: 0,
      candidateSeconds: 0,
      totalSeconds: 0,
      interviewerPercent: 0,
      candidatePercent: 0,
      silenceSeconds: 0,
      longestInterviewerSegment: 0,
      longestCandidateSegment: 0,
      isBalanced: false,
    };
  }

  let interviewerSeconds = 0;
  let candidateSeconds = 0;
  let longestInterviewerSegment = 0;
  let longestCandidateSegment = 0;

  for (const seg of segments) {
    const duration = Math.max(0, seg.end - seg.start);

    if (seg.speaker === 'interviewer') {
      interviewerSeconds += duration;
      longestInterviewerSegment = Math.max(longestInterviewerSegment, duration);
    } else if (seg.speaker === 'candidate') {
      candidateSeconds += duration;
      longestCandidateSegment = Math.max(longestCandidateSegment, duration);
    }
    // 'unknown' segments are excluded from interviewer/candidate totals
  }

  // totalSeconds = max segment end value (not sum of all segments)
  const totalSeconds = Math.max(...segments.map((s) => s.end), 0);

  const spokenSeconds = interviewerSeconds + candidateSeconds;
  const silenceSeconds = Math.max(0, totalSeconds - spokenSeconds);

  const interviewerPercent = spokenSeconds > 0
    ? Math.round((interviewerSeconds / spokenSeconds) * 100)
    : 0;
  const candidatePercent = spokenSeconds > 0
    ? Math.round((candidateSeconds / spokenSeconds) * 100)
    : 0;

  const isBalanced = interviewerPercent >= 25 && interviewerPercent <= 50;

  return {
    interviewerSeconds: Math.round(interviewerSeconds),
    candidateSeconds: Math.round(candidateSeconds),
    totalSeconds: Math.round(totalSeconds),
    interviewerPercent,
    candidatePercent,
    silenceSeconds: Math.round(silenceSeconds),
    longestInterviewerSegment: Math.round(longestInterviewerSegment),
    longestCandidateSegment: Math.round(longestCandidateSegment),
    isBalanced,
  };
}
