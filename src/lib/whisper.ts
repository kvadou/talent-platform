import OpenAI, { toFile } from 'openai';
import { getOpenAI } from './openai';

export interface TranscriptSegment {
  speaker: 'interviewer' | 'candidate' | 'unknown';
  start: number; // seconds
  end: number; // seconds
  text: string;
}

export interface TranscriptionResult {
  fullText: string;
  segments: TranscriptSegment[];
  duration: number;
  language: string;
}

/**
 * Transcribe audio using OpenAI Whisper API
 * Returns timestamped segments with speaker labels
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string = 'interview.m4a'
): Promise<TranscriptionResult> {
  const openai = getOpenAI();

  // Create a file from the buffer using OpenAI's toFile utility
  const file = await toFile(audioBuffer, filename, {
    type: getAudioMimeType(filename),
  });

  // Call Whisper API with verbose_json for timestamps
  const response = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  });

  // Extract segments with timestamps
  const rawSegments = (response as any).segments || [];

  // Process segments and attempt speaker diarization
  const segments = diarizeSpeakers(rawSegments);

  return {
    fullText: response.text,
    segments,
    duration: (response as any).duration || 0,
    language: (response as any).language || 'en',
  };
}

/**
 * Basic two-speaker diarization based on audio patterns
 * This is a simplified approach - for production, consider using
 * a dedicated diarization service like pyannote or AssemblyAI
 */
function diarizeSpeakers(rawSegments: any[]): TranscriptSegment[] {
  if (rawSegments.length === 0) return [];

  const segments: TranscriptSegment[] = [];
  let currentSpeaker: 'interviewer' | 'candidate' = 'interviewer';
  let lastEnd = 0;

  for (const seg of rawSegments) {
    const start = seg.start || 0;
    const end = seg.end || start;
    const text = (seg.text || '').trim();

    if (!text) continue;

    // Simple heuristic: if there's a significant pause (>2s),
    // assume speaker change
    const pauseDuration = start - lastEnd;
    if (pauseDuration > 2) {
      currentSpeaker = currentSpeaker === 'interviewer' ? 'candidate' : 'interviewer';
    }

    // Also detect speaker change based on text patterns
    if (detectQuestionPattern(text) && currentSpeaker === 'candidate') {
      currentSpeaker = 'interviewer';
    }

    segments.push({
      speaker: currentSpeaker,
      start,
      end,
      text,
    });

    lastEnd = end;

    // After a question, switch to candidate
    if (detectQuestionPattern(text) && currentSpeaker === 'interviewer') {
      currentSpeaker = 'candidate';
    }
  }

  return segments;
}

/**
 * Detect if text is likely a question (interviewer pattern)
 */
function detectQuestionPattern(text: string): boolean {
  const questionWords = [
    'what', 'why', 'how', 'when', 'where', 'who', 'which',
    'tell me', 'can you', 'could you', 'would you', 'do you',
    'have you', 'are you', 'is there', 'describe', 'explain',
  ];

  const lowerText = text.toLowerCase();

  // Check if ends with question mark
  if (text.trim().endsWith('?')) return true;

  // Check for question starters
  return questionWords.some(word => lowerText.startsWith(word));
}

/**
 * Get MIME type for audio file
 */
function getAudioMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    wav: 'audio/wav',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
  };
  return mimeTypes[ext || ''] || 'audio/mpeg';
}

/**
 * Estimate transcription cost
 * Whisper pricing: $0.006 per minute
 */
export function estimateTranscriptionCost(durationSeconds: number): number {
  const minutes = Math.ceil(durationSeconds / 60);
  return minutes * 0.006;
}

/**
 * Format transcript segments for display
 */
export function formatTranscriptForDisplay(segments: TranscriptSegment[]): string {
  return segments
    .map((seg) => {
      const timestamp = formatTimestamp(seg.start);
      const speaker = seg.speaker === 'interviewer' ? 'Interviewer' : 'Candidate';
      return `[${timestamp}] ${speaker}: ${seg.text}`;
    })
    .join('\n\n');
}

/**
 * Format seconds to MM:SS
 */
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Merge adjacent segments from the same speaker
 */
export function mergeAdjacentSegments(
  segments: TranscriptSegment[],
  maxGap: number = 1 // seconds
): TranscriptSegment[] {
  if (segments.length === 0) return [];

  const merged: TranscriptSegment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const gap = seg.start - current.end;

    if (seg.speaker === current.speaker && gap <= maxGap) {
      // Merge with current segment
      current.end = seg.end;
      current.text = `${current.text} ${seg.text}`;
    } else {
      // Start new segment
      merged.push(current);
      current = { ...seg };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Search transcript for keyword
 */
export function searchTranscript(
  segments: TranscriptSegment[],
  query: string
): TranscriptSegment[] {
  const lowerQuery = query.toLowerCase();
  return segments.filter((seg) =>
    seg.text.toLowerCase().includes(lowerQuery)
  );
}
