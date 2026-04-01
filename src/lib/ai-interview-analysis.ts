import { getOpenAI } from './openai';
import { TranscriptSegment } from './whisper';
import { getVerifiedPatternsForPrompt } from './pattern-extraction';

export interface ScorecardAttribute {
  id: string;
  name: string;
  description: string | null;
  categoryName: string;
}

export interface AttributeAnalysis {
  attributeId: string;
  attributeName: string;
  suggestedRating: number; // 1-4 scale
  evidence: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface InterviewAnalysisResult {
  summary: string;
  attributeAnalysis: AttributeAnalysis[];
  recommendation: 'STRONG_YES' | 'YES' | 'NO' | 'STRONG_NO';
  recommendationScore: number; // 0-100
  recommendationReason: string;
  strengths: string[];
  concerns: string[];
  followUpQuestions: string[];
}

interface AnalysisContext {
  candidateName: string;
  jobTitle: string;
  jobId?: string; // For fetching job-specific verified patterns
  jobDescription?: string;
  interviewType: string;
  attributes: ScorecardAttribute[];
}

/**
 * Analyze an interview transcript and generate AI insights
 */
export async function analyzeInterviewTranscript(
  transcript: {
    fullText: string;
    segments: TranscriptSegment[];
  },
  context: AnalysisContext
): Promise<InterviewAnalysisResult> {
  const openai = getOpenAI();

  // Fetch verified patterns if job ID is provided
  let patternsSection = '';
  if (context.jobId) {
    try {
      const patterns = await getVerifiedPatternsForPrompt(context.jobId);
      if (patterns.positivePatterns.length > 0 || patterns.redFlags.length > 0) {
        patternsSection = '\n\nLEARNED PATTERNS FROM SUCCESSFUL HIRES:';
        if (patterns.positivePatterns.length > 0) {
          patternsSection += '\nPositive signals (look for these):';
          patterns.positivePatterns.slice(0, 10).forEach((p) => {
            patternsSection += `\n- ${p}`;
          });
        }
        if (patterns.redFlags.length > 0) {
          patternsSection += '\n\nRed flags (watch out for these):';
          patterns.redFlags.slice(0, 10).forEach((p) => {
            patternsSection += `\n- ${p}`;
          });
        }
      }
    } catch (error) {
      // Silently ignore pattern fetch errors - analysis can proceed without them
      console.warn('Failed to fetch verified patterns:', error);
    }
  }

  // Build the attribute list for the prompt
  const attributeList = context.attributes
    .map((a) => `- ${a.name}${a.description ? `: ${a.description}` : ''} (Category: ${a.categoryName})`)
    .join('\n');

  // Format transcript with speaker labels
  const formattedTranscript = transcript.segments
    .map((seg) => {
      const speaker = seg.speaker === 'interviewer' ? 'Interviewer' : 'Candidate';
      const timestamp = formatTime(seg.start);
      return `[${timestamp}] ${speaker}: ${seg.text}`;
    })
    .join('\n\n');

  // Truncate if too long (keep under ~30k chars for context limits)
  const truncatedTranscript = formattedTranscript.length > 30000
    ? formattedTranscript.slice(0, 30000) + '\n\n[Transcript truncated...]'
    : formattedTranscript;

  const systemPrompt = `You are an expert interview analyst for a chess education company (Acme Talent).
Your task is to analyze interview transcripts and provide structured feedback.

The company teaches chess to children ages 3-9 using storytelling methods.
Key qualities for employees include:
- Ability to engage young children
- Strong communication and presentation skills
- Patience and enthusiasm
- Understanding of chess (teaching chess is a plus)
- Reliability and professionalism
${patternsSection}

Analyze objectively. Base all observations on specific evidence from the transcript.
If you don't have enough evidence for a rating, say so clearly.`;

  const userPrompt = `Analyze this ${context.interviewType} interview for the position of "${context.jobTitle}".

CANDIDATE: ${context.candidateName}

${context.jobDescription ? `JOB DESCRIPTION:\n${context.jobDescription.slice(0, 2000)}\n\n` : ''}

SCORECARD ATTRIBUTES TO EVALUATE:
${attributeList}

TRANSCRIPT:
${truncatedTranscript}

---

Provide your analysis in the following JSON format:
{
  "summary": "2-3 paragraph overview of the interview, key observations, and overall impression",
  "attributeAnalysis": [
    {
      "attributeId": "attribute-id-here",
      "attributeName": "Attribute Name",
      "suggestedRating": 1-4,
      "evidence": ["specific quote or observation 1", "specific quote or observation 2"],
      "confidence": "high|medium|low"
    }
  ],
  "recommendation": "STRONG_YES|YES|NO|STRONG_NO",
  "recommendationScore": 0-100,
  "recommendationReason": "1-2 sentence explanation of the recommendation",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "concerns": ["concern 1", "concern 2"],
  "followUpQuestions": ["question 1", "question 2"]
}

RATING SCALE:
1 = Does not meet expectations / No evidence
2 = Partially meets expectations / Some concerns
3 = Meets expectations / Solid performance
4 = Exceeds expectations / Outstanding

Return ONLY valid JSON, no markdown formatting.`;

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

    // Clean up potential markdown code blocks
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const result = JSON.parse(cleanedContent) as InterviewAnalysisResult;

    // Validate and sanitize the result
    return {
      summary: result.summary || 'Analysis could not be generated.',
      attributeAnalysis: Array.isArray(result.attributeAnalysis)
        ? result.attributeAnalysis.map((a) => ({
            attributeId: a.attributeId || '',
            attributeName: a.attributeName || '',
            suggestedRating: Math.min(4, Math.max(1, Number(a.suggestedRating) || 2)),
            evidence: Array.isArray(a.evidence) ? a.evidence : [],
            confidence: ['high', 'medium', 'low'].includes(a.confidence)
              ? a.confidence
              : 'low',
          }))
        : [],
      recommendation: ['STRONG_YES', 'YES', 'NO', 'STRONG_NO'].includes(result.recommendation)
        ? result.recommendation
        : 'NO',
      recommendationScore: Math.min(100, Math.max(0, Number(result.recommendationScore) || 50)),
      recommendationReason: result.recommendationReason || '',
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      concerns: Array.isArray(result.concerns) ? result.concerns : [],
      followUpQuestions: Array.isArray(result.followUpQuestions) ? result.followUpQuestions : [],
    };
  } catch (error) {
    console.error('Failed to analyze interview transcript:', error);
    throw new Error('Interview analysis failed');
  }
}

/**
 * Generate a quick summary without full attribute analysis
 * (Useful for transcripts without a configured scorecard)
 */
export async function generateQuickSummary(
  transcript: {
    fullText: string;
    segments: TranscriptSegment[];
  },
  context: {
    candidateName: string;
    jobTitle: string;
    interviewType: string;
  }
): Promise<{
  summary: string;
  recommendation: 'STRONG_YES' | 'YES' | 'NO' | 'STRONG_NO';
  recommendationScore: number;
  recommendationReason: string;
  strengths: string[];
  concerns: string[];
}> {
  const openai = getOpenAI();

  // Format transcript
  const formattedTranscript = transcript.segments
    .map((seg) => {
      const speaker = seg.speaker === 'interviewer' ? 'Interviewer' : 'Candidate';
      return `${speaker}: ${seg.text}`;
    })
    .join('\n\n')
    .slice(0, 20000);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an interview analyst. Provide a concise summary and hiring recommendation based on the transcript.`,
      },
      {
        role: 'user',
        content: `Analyze this ${context.interviewType} for ${context.candidateName} applying for ${context.jobTitle}.

TRANSCRIPT:
${formattedTranscript}

Respond in JSON:
{
  "summary": "2-3 paragraph summary",
  "recommendation": "STRONG_YES|YES|NO|STRONG_NO",
  "recommendationScore": 0-100,
  "recommendationReason": "brief explanation",
  "strengths": ["strength 1", "strength 2"],
  "concerns": ["concern 1", "concern 2"]
}

Return ONLY valid JSON.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content?.trim() || '{}';
  const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const result = JSON.parse(cleanedContent);

  return {
    summary: result.summary || '',
    recommendation: result.recommendation || 'NO',
    recommendationScore: result.recommendationScore || 50,
    recommendationReason: result.recommendationReason || '',
    strengths: result.strengths || [],
    concerns: result.concerns || [],
  };
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
