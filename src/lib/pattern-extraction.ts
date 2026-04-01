import { getOpenAI } from './openai';
import { prisma } from './prisma';
import { PatternType } from '@prisma/client';
import { TranscriptSegment } from './whisper';

/**
 * Extracted pattern from AI analysis
 */
export interface ExtractedPattern {
  patternType: PatternType;
  pattern: string;
  context: string;
  positiveSignal: boolean;
  confidence: number;
}

/**
 * Extracted Q&A example from AI analysis
 */
export interface ExtractedQA {
  question: string;
  questionIntent: string;
  answer: string;
  isGoodExample: boolean;
  explanation: string;
  qualityScore: number;
}

/**
 * Result from pattern extraction
 */
export interface PatternExtractionResult {
  patterns: ExtractedPattern[];
  qaExamples: ExtractedQA[];
}

/**
 * Extract patterns and Q&A examples from a single transcript
 */
export async function extractPatternsFromTranscript(
  transcript: {
    fullText: string;
    segments: TranscriptSegment[];
  },
  context: {
    wasSuccessfulHire: boolean;
    jobTitle: string;
    jobId?: string;
    interviewId: string;
  }
): Promise<PatternExtractionResult> {
  const openai = getOpenAI();

  // Format transcript with speaker labels
  const formattedTranscript = transcript.segments
    .map((seg) => {
      const speaker = seg.speaker === 'interviewer' ? 'Interviewer' : 'Candidate';
      return `${speaker}: ${seg.text}`;
    })
    .join('\n\n')
    .slice(0, 25000); // Keep under token limits

  const systemPrompt = `You are an expert at identifying hiring patterns from interview transcripts.
Your task is to extract:
1. Communication patterns that predict job success/failure
2. Question-answer examples that demonstrate good or bad responses

This transcript is from a candidate who ${context.wasSuccessfulHire ? 'WAS hired and is performing well' : 'was NOT hired or did not perform well'}.

Extract patterns that help predict future hiring success.`;

  const userPrompt = `Analyze this ${context.jobTitle} interview transcript and extract patterns.

TRANSCRIPT:
${formattedTranscript}

---

Extract patterns in this JSON format:
{
  "patterns": [
    {
      "patternType": "ANSWER_QUALITY|COMMUNICATION_STYLE|ENTHUSIASM_SIGNAL|RED_FLAG|EXPERIENCE_CLAIM|QUESTION_ASKED",
      "pattern": "specific phrase, behavior, or response pattern observed",
      "context": "when this pattern matters or what it indicates",
      "positiveSignal": true/false,
      "confidence": 0.0-1.0
    }
  ],
  "qaExamples": [
    {
      "question": "the interview question asked",
      "questionIntent": "what the interviewer was trying to learn",
      "answer": "the candidate's response (verbatim or summarized)",
      "isGoodExample": true/false,
      "explanation": "why this is a good or bad answer",
      "qualityScore": 1-5
    }
  ]
}

PATTERN TYPES:
- ANSWER_QUALITY: How thoroughly/clearly they answer questions
- COMMUNICATION_STYLE: How they communicate (concise, rambling, confident, etc.)
- ENTHUSIASM_SIGNAL: Signs of genuine interest or lack thereof
- RED_FLAG: Warning signs that predict poor outcomes
- EXPERIENCE_CLAIM: How they describe their experience (specific vs vague)
- QUESTION_ASKED: Questions they ask the interviewer

Focus on:
- Specific, actionable patterns (not generic observations)
- Patterns with predictive value for hiring success
- High-quality Q&A examples that could train future evaluations
- ${context.wasSuccessfulHire ? 'Positive patterns that indicate good fit' : 'Warning signs or areas of weakness'}

Return ONLY valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content?.trim() || '{}';
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const result = JSON.parse(cleanedContent);

    // Validate and sanitize patterns
    const patterns: ExtractedPattern[] = Array.isArray(result.patterns)
      ? result.patterns
          .filter((p: Record<string, unknown>) => p.pattern && p.patternType)
          .map((p: Record<string, unknown>) => ({
            patternType: validatePatternType(p.patternType as string),
            pattern: String(p.pattern || ''),
            context: String(p.context || ''),
            positiveSignal: Boolean(p.positiveSignal),
            confidence: Math.min(1, Math.max(0, Number(p.confidence) || 0.5)),
          }))
      : [];

    // Validate and sanitize Q&A examples
    const qaExamples: ExtractedQA[] = Array.isArray(result.qaExamples)
      ? result.qaExamples
          .filter((q: Record<string, unknown>) => q.question && q.answer)
          .map((q: Record<string, unknown>) => ({
            question: String(q.question || ''),
            questionIntent: String(q.questionIntent || ''),
            answer: String(q.answer || ''),
            isGoodExample: Boolean(q.isGoodExample),
            explanation: String(q.explanation || ''),
            qualityScore: Math.min(5, Math.max(1, Number(q.qualityScore) || 3)),
          }))
      : [];

    return { patterns, qaExamples };
  } catch (error) {
    console.error('Failed to extract patterns from transcript:', error);
    return { patterns: [], qaExamples: [] };
  }
}

/**
 * Run pattern extraction on all eligible transcripts
 * (Interviews with hiring outcomes and transcripts)
 */
export async function runPatternExtractionJob(options: {
  jobId?: string;
  limit?: number;
  minRetentionDays?: number;
}): Promise<{
  processed: number;
  patternsExtracted: number;
  qaExtracted: number;
}> {
  const { jobId, limit = 50, minRetentionDays = 30 } = options;

  // Find interviews with:
  // 1. A transcript
  // 2. A hiring outcome recorded
  // 3. Good retention (if hired) or confirmed rejection
  const interviews = await prisma.interview.findMany({
    where: {
      recording: {
        transcript: { isNot: null },
      },
      application: {
        hiringOutcome: { isNot: null },
        ...(jobId ? { jobId } : {}),
      },
    },
    include: {
      recording: {
        include: { transcript: true },
      },
      application: {
        include: {
          job: { select: { id: true, title: true } },
          hiringOutcome: true,
        },
      },
    },
    take: limit,
    orderBy: { scheduledAt: 'desc' },
  });

  let processed = 0;
  let patternsExtracted = 0;
  let qaExtracted = 0;

  for (const interview of interviews) {
    if (!interview.recording?.transcript) continue;

    const outcome = interview.application.hiringOutcome;
    if (!outcome) continue;

    // Determine if this was a successful hire
    // Success = hired AND (retained at 30 days OR no termination data yet)
    const wasSuccessfulHire =
      outcome.wasHired &&
      (outcome.stillEmployedAt30Days === true || outcome.stillEmployedAt30Days === null);

    // Parse transcript segments (Prisma JSON needs double cast)
    const segments = interview.recording.transcript.segments as unknown as TranscriptSegment[];

    try {
      const result = await extractPatternsFromTranscript(
        {
          fullText: interview.recording.transcript.fullText,
          segments,
        },
        {
          wasSuccessfulHire,
          jobTitle: interview.application.job.title,
          jobId: interview.application.job.id,
          interviewId: interview.id,
        }
      );

      // Store patterns
      for (const pattern of result.patterns) {
        await prisma.interviewPattern.create({
          data: {
            jobId: interview.application.job.id,
            patternType: pattern.patternType,
            pattern: pattern.pattern,
            context: pattern.context,
            positiveSignal: pattern.positiveSignal,
            confidence: pattern.confidence,
            exampleCount: 1,
            sourceInterviewIds: [interview.id],
          },
        });
        patternsExtracted++;
      }

      // Store Q&A examples
      for (const qa of result.qaExamples) {
        await prisma.questionAnswerExample.create({
          data: {
            jobId: interview.application.job.id,
            question: qa.question,
            questionIntent: qa.questionIntent,
            exampleAnswer: qa.answer,
            isGoodExample: qa.isGoodExample,
            explanation: qa.explanation,
            qualityScore: qa.qualityScore,
            sourceInterviewId: interview.id,
            sourceTranscriptId: interview.recording.transcript.id,
          },
        });
        qaExtracted++;
      }

      processed++;
    } catch (error) {
      console.error(`Failed to process interview ${interview.id}:`, error);
    }
  }

  return { processed, patternsExtracted, qaExtracted };
}

/**
 * Consolidate similar patterns (merge duplicates, update confidence)
 */
export async function consolidatePatterns(jobId?: string): Promise<{
  merged: number;
  updated: number;
}> {
  const openai = getOpenAI();

  // Fetch all unverified patterns for the job
  const patterns = await prisma.interviewPattern.findMany({
    where: {
      isVerified: false,
      ...(jobId ? { jobId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  if (patterns.length < 2) {
    return { merged: 0, updated: 0 };
  }

  // Group by pattern type
  const byType = new Map<PatternType, typeof patterns>();
  for (const p of patterns) {
    const group = byType.get(p.patternType) || [];
    group.push(p);
    byType.set(p.patternType, group);
  }

  let merged = 0;
  let updated = 0;

  // For each type, find similar patterns using AI
  for (const [patternType, group] of byType) {
    if (group.length < 2) continue;

    const patternList = group.map((p, i) => `${i + 1}. ${p.pattern}`).join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You identify duplicate or very similar patterns that should be merged.',
        },
        {
          role: 'user',
          content: `These are ${patternType} patterns. Identify which ones are duplicates or essentially the same thing.

${patternList}

Return JSON: { "mergeGroups": [[1, 3, 5], [2, 4]], "noMerge": [6, 7] }
- mergeGroups: Arrays of pattern numbers that should be merged together
- noMerge: Pattern numbers that are unique

Return ONLY valid JSON.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim() || '{}';
    const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const result = JSON.parse(cleanedContent);
      const mergeGroups: number[][] = result.mergeGroups || [];

      for (const mergeGroup of mergeGroups) {
        if (mergeGroup.length < 2) continue;

        // Get the patterns to merge (indices are 1-based)
        const toMerge = mergeGroup.map((i) => group[i - 1]).filter(Boolean);
        if (toMerge.length < 2) continue;

        // Keep the first one, merge others into it
        const primary = toMerge[0];
        const others = toMerge.slice(1);

        // Combine source interview IDs
        const allSourceIds = new Set(primary.sourceInterviewIds);
        for (const other of others) {
          for (const id of other.sourceInterviewIds) {
            allSourceIds.add(id);
          }
        }

        // Update primary with combined data
        await prisma.interviewPattern.update({
          where: { id: primary.id },
          data: {
            exampleCount: toMerge.reduce((sum, p) => sum + p.exampleCount, 0),
            confidence: Math.max(...toMerge.map((p) => p.confidence)),
            sourceInterviewIds: Array.from(allSourceIds),
          },
        });
        updated++;

        // Delete the duplicates
        for (const other of others) {
          await prisma.interviewPattern.delete({
            where: { id: other.id },
          });
          merged++;
        }
      }
    } catch (e) {
      console.error('Failed to parse merge response:', e);
    }
  }

  return { merged, updated };
}

/**
 * Get verified patterns to include in AI prompts
 */
export async function getVerifiedPatternsForPrompt(jobId: string): Promise<{
  positivePatterns: string[];
  redFlags: string[];
}> {
  const patterns = await prisma.interviewPattern.findMany({
    where: {
      isVerified: true,
      OR: [{ jobId }, { jobId: null }], // Include job-specific and universal patterns
    },
    orderBy: [{ confidence: 'desc' }, { exampleCount: 'desc' }],
  });

  const positivePatterns: string[] = [];
  const redFlags: string[] = [];

  for (const p of patterns) {
    const formatted = `${p.pattern}${p.context ? ` (${p.context})` : ''}`;
    if (p.positiveSignal) {
      positivePatterns.push(formatted);
    } else {
      redFlags.push(formatted);
    }
  }

  return { positivePatterns, redFlags };
}

/**
 * Helper to validate PatternType enum
 */
function validatePatternType(type: string): PatternType {
  const validTypes: PatternType[] = [
    'ANSWER_QUALITY',
    'COMMUNICATION_STYLE',
    'ENTHUSIASM_SIGNAL',
    'RED_FLAG',
    'EXPERIENCE_CLAIM',
    'QUESTION_ASKED',
  ];

  if (validTypes.includes(type as PatternType)) {
    return type as PatternType;
  }

  return 'ANSWER_QUALITY'; // Default fallback
}
