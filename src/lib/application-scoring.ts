import { getOpenAI } from './openai';
import { prisma } from './prisma';
import { checkAndAutoAdvance, AutoAdvanceResult } from './automation/auto-advance';

export interface ScoreBreakdown {
  resumeFit: number; // 0-100: How well resume matches job requirements
  answerCompleteness: number; // 0-100: % of questions answered
  answerQuality: number; // 0-100: Thoughtfulness of answers
  overallScore: number; // 0-100: Weighted combination
  factors: {
    hasResume: boolean;
    totalQuestions: number;
    answeredQuestions: number;
    avgAnswerLength: number;
  };
}

interface ScoringInput {
  applicationId: string;
  candidateName: string;
  resumeText: string | null;
  jobTitle: string;
  jobDescription: string | null;
  questions: Array<{ label: string; required: boolean }>;
  answers: Array<{ questionLabel: string; value: string }>;
}

export interface ScoringResult {
  breakdown: ScoreBreakdown;
  autoAdvance?: AutoAdvanceResult;
}

/**
 * Score an application based on resume fit and answer quality.
 * Optionally triggers auto-advance if the job is configured for it.
 */
export async function scoreApplication(
  applicationId: string,
  options?: { skipAutoAdvance?: boolean }
): Promise<ScoringResult> {
  // Fetch all required data
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      candidate: {
        select: {
          firstName: true,
          lastName: true,
          resumeText: true,
        },
      },
      job: {
        select: {
          title: true,
          description: true,
          questions: {
            select: { id: true, label: true, required: true },
            orderBy: { order: 'asc' },
          },
        },
      },
      answers: {
        select: {
          questionId: true,
          value: true,
          question: { select: { label: true } },
        },
      },
    },
  });

  if (!application) {
    throw new Error(`Application ${applicationId} not found`);
  }

  const input: ScoringInput = {
    applicationId,
    candidateName: `${application.candidate.firstName} ${application.candidate.lastName}`,
    resumeText: application.candidate.resumeText,
    jobTitle: application.job.title,
    jobDescription: application.job.description,
    questions: application.job.questions.map((q) => ({
      label: q.label,
      required: q.required,
    })),
    answers: application.answers.map((a) => ({
      questionLabel: a.question.label,
      value: a.value,
    })),
  };

  // Calculate component scores
  const answerCompleteness = calculateAnswerCompleteness(input);
  const resumeFit = await calculateResumeFit(input);
  const answerQuality = await calculateAnswerQuality(input);

  // Calculate weighted overall score
  // Weights: Resume 40%, Answer Quality 35%, Completeness 25%
  const overallScore = Math.round(
    resumeFit * 0.4 + answerQuality * 0.35 + answerCompleteness * 0.25
  );

  const breakdown: ScoreBreakdown = {
    resumeFit,
    answerCompleteness,
    answerQuality,
    overallScore,
    factors: {
      hasResume: !!input.resumeText,
      totalQuestions: input.answers.length, // Questions shown to candidate (based on answers received)
      answeredQuestions: input.answers.filter((a) => a.value?.trim()).length,
      avgAnswerLength:
        input.answers.length > 0
          ? Math.round(
              input.answers.reduce((sum, a) => sum + (a.value?.length || 0), 0) /
                input.answers.length
            )
          : 0,
    },
  };

  // Save score to database
  await prisma.application.update({
    where: { id: applicationId },
    data: {
      aiScore: overallScore,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      aiScoreBreakdown: JSON.parse(JSON.stringify(breakdown)) as any,
      aiScoredAt: new Date(),
    },
  });

  // Check if application should be auto-advanced
  let autoAdvanceResult: AutoAdvanceResult | undefined;
  if (!options?.skipAutoAdvance) {
    try {
      autoAdvanceResult = await checkAndAutoAdvance(applicationId);
      if (autoAdvanceResult.advanced) {
        console.log(
          `[Auto-advance] ${applicationId} advanced from ${autoAdvanceResult.fromStage} to ${autoAdvanceResult.toStage} (score: ${autoAdvanceResult.score})`
        );
      }
    } catch (error) {
      console.error(`[Auto-advance] Failed for ${applicationId}:`, error);
    }
  }

  return {
    breakdown,
    autoAdvance: autoAdvanceResult,
  };
}

/**
 * Calculate answer completeness as percentage of questions answered
 *
 * We use the number of answers the candidate has (not total job questions)
 * because candidates may only see a subset of questions on their form.
 * If they answered all questions they were shown, that's 100% complete.
 */
function calculateAnswerCompleteness(input: ScoringInput): number {
  // If no answers at all, and there are questions, that's 0%
  if (input.answers.length === 0) {
    return input.questions.length > 0 ? 0 : 100;
  }

  // Count answers with actual content vs total answers received
  // This measures: "of the questions they were shown, how many did they fill out?"
  const answeredCount = input.answers.filter((a) => a.value?.trim()).length;
  const totalQuestionsShown = input.answers.length;

  return Math.round((answeredCount / totalQuestionsShown) * 100);
}

/**
 * Use AI to score how well the resume matches the job requirements
 */
async function calculateResumeFit(input: ScoringInput): Promise<number> {
  // If no resume, give a neutral score (don't penalize too harshly)
  if (!input.resumeText?.trim()) {
    return 40; // Below average but not zero
  }

  // If no job description, can't assess fit
  if (!input.jobDescription?.trim()) {
    return 60; // Neutral score
  }

  const openai = getOpenAI();

  const prompt = `You are an expert recruiter evaluating candidate-job fit.

JOB TITLE: ${input.jobTitle}

JOB REQUIREMENTS:
${input.jobDescription.substring(0, 2000)}

CANDIDATE RESUME:
${input.resumeText.substring(0, 3000)}

Rate how well this candidate's background matches the job requirements on a scale of 0-100:
- 0-20: No relevant experience or skills
- 21-40: Minimal relevant experience
- 41-60: Some relevant experience but gaps exist
- 61-80: Good match with most requirements met
- 81-100: Excellent match, exceeds requirements

Consider:
1. Relevant work experience
2. Required skills mentioned
3. Industry/domain experience
4. Education/certifications if mentioned in requirements

Respond with ONLY a JSON object: {"score": <number>, "reason": "<one sentence explanation>"}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 150,
    });

    const content = response.choices[0]?.message?.content || '';
    const parsed = JSON.parse(content);
    return Math.min(100, Math.max(0, Math.round(parsed.score)));
  } catch (error) {
    console.error('Resume fit scoring failed:', error);
    return 50; // Neutral fallback
  }
}

/**
 * Use AI to score the quality/thoughtfulness of application answers
 */
async function calculateAnswerQuality(input: ScoringInput): Promise<number> {
  // If no questions or no answers, give neutral score
  if (input.questions.length === 0) {
    return 70; // No questions to answer
  }

  const answeredQuestions = input.answers.filter((a) => a.value?.trim());
  if (answeredQuestions.length === 0) {
    return 0; // No answers provided
  }

  // Quick heuristics for obvious cases
  const avgLength =
    answeredQuestions.reduce((sum, a) => sum + a.value.length, 0) /
    answeredQuestions.length;

  // Very short answers (< 20 chars average) get low scores
  if (avgLength < 20) {
    return 20;
  }

  // Use AI for more nuanced scoring
  const openai = getOpenAI();

  const answersText = answeredQuestions
    .map((a) => `Q: ${a.questionLabel}\nA: ${a.value}`)
    .join('\n\n');

  const prompt = `You are evaluating the quality of a job applicant's answers to screening questions.

JOB: ${input.jobTitle}

QUESTIONS AND ANSWERS:
${answersText.substring(0, 2000)}

Rate the overall quality of these answers on a scale of 0-100:
- 0-20: Minimal effort, one-word or irrelevant answers
- 21-40: Brief answers lacking detail or thought
- 41-60: Adequate answers that address the questions
- 61-80: Good answers showing genuine interest and relevant detail
- 81-100: Excellent, thoughtful answers demonstrating strong fit and enthusiasm

Consider:
1. Did they actually answer what was asked?
2. Do answers show genuine interest in the role?
3. Are answers specific rather than generic?
4. Do answers demonstrate relevant experience or skills?

Respond with ONLY a JSON object: {"score": <number>, "reason": "<one sentence explanation>"}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 150,
    });

    const content = response.choices[0]?.message?.content || '';
    const parsed = JSON.parse(content);
    return Math.min(100, Math.max(0, Math.round(parsed.score)));
  } catch (error) {
    console.error('Answer quality scoring failed:', error);
    // Fallback to length-based heuristic
    if (avgLength > 200) return 70;
    if (avgLength > 100) return 55;
    if (avgLength > 50) return 40;
    return 30;
  }
}

export interface BatchScoringResult {
  scored: number;
  autoAdvanced: number;
  results: Map<string, ScoringResult>;
}

/**
 * Score multiple applications in batch (for efficiency)
 */
export async function scoreApplicationsBatch(
  applicationIds: string[],
  options?: {
    onProgress?: (completed: number, total: number, result: ScoringResult) => void;
    skipAutoAdvance?: boolean;
  }
): Promise<BatchScoringResult> {
  const results = new Map<string, ScoringResult>();
  let autoAdvancedCount = 0;

  for (let i = 0; i < applicationIds.length; i++) {
    try {
      const result = await scoreApplication(applicationIds[i], {
        skipAutoAdvance: options?.skipAutoAdvance,
      });
      results.set(applicationIds[i], result);

      if (result.autoAdvance?.advanced) {
        autoAdvancedCount++;
      }

      options?.onProgress?.(i + 1, applicationIds.length, result);
    } catch (error) {
      console.error(`Failed to score application ${applicationIds[i]}:`, error);
    }

    // Small delay to avoid rate limiting
    if (i < applicationIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return {
    scored: results.size,
    autoAdvanced: autoAdvancedCount,
    results,
  };
}
