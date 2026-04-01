import OpenAI from 'openai';

// Lazy initialization to avoid issues during build
let openaiClient: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Generate keyword expansions (synonyms and related terms) for job matching
 */
export async function generateKeywordExpansions(
  keyword: string,
  context?: { jobTitle?: string; jobDescription?: string }
): Promise<string[]> {
  const openai = getOpenAI();

  const contextInfo = context?.jobTitle
    ? `The job is for: ${context.jobTitle}${context.jobDescription ? `. Description: ${context.jobDescription.slice(0, 500)}` : ''}`
    : '';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a recruiting specialist helping match candidates to jobs. Generate synonyms and related terms for job matching keywords.

Rules:
- Return ONLY a JSON array of strings
- Include synonyms, related job titles, and common variations
- Include both formal and informal terms
- Include abbreviations if common (e.g., "dev" for "developer")
- Include gender-neutral variations if applicable
- Maximum 8 expansions
- No duplicates
- Terms should be directly related for resume/candidate matching`,
      },
      {
        role: 'user',
        content: `Generate matching synonyms for the keyword: "${keyword}"
${contextInfo}

Return a JSON array of alternative terms that would match similar candidates.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 200,
  });

  const content = response.choices[0]?.message?.content?.trim() || '[]';

  try {
    // Parse JSON response, handling potential markdown code blocks
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const expansions = JSON.parse(cleanedContent);

    if (!Array.isArray(expansions)) {
      console.warn('OpenAI returned non-array response for keyword expansions');
      return [];
    }

    // Filter to strings only and limit to 8
    return expansions
      .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
      .map((e) => e.toLowerCase().trim())
      .filter((e) => e !== keyword.toLowerCase()) // Don't include the original keyword
      .slice(0, 8);
  } catch (err) {
    console.error('Failed to parse OpenAI keyword expansion response:', content, err);
    return [];
  }
}

/**
 * Generate an embedding vector for text using OpenAI's text-embedding-3-small model
 * Returns a 1536-dimensional vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();

  // Truncate to ~8000 tokens (roughly 32000 chars) - model limit is 8191 tokens
  const truncatedText = text.slice(0, 32000);

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: truncatedText,
    encoding_format: 'float',
  });

  return response.data[0].embedding;
}

/**
 * Generate embedding for a candidate based on their profile
 * Combines resume text, name, notes, and other relevant fields
 */
export async function generateCandidateEmbedding(candidate: {
  firstName: string;
  lastName: string;
  resumeText?: string | null;
  notes?: string | null;
  coverLetter?: string | null;
  tags?: string[];
}): Promise<number[]> {
  // Build a comprehensive text representation of the candidate
  const parts: string[] = [];

  // Name context
  parts.push(`Candidate: ${candidate.firstName} ${candidate.lastName}`);

  // Resume is most important
  if (candidate.resumeText) {
    parts.push(`Resume: ${candidate.resumeText}`);
  }

  // Cover letter adds context
  if (candidate.coverLetter) {
    parts.push(`Cover Letter: ${candidate.coverLetter}`);
  }

  // Notes from recruiters
  if (candidate.notes) {
    parts.push(`Notes: ${candidate.notes}`);
  }

  // Tags
  if (candidate.tags && candidate.tags.length > 0) {
    parts.push(`Skills/Tags: ${candidate.tags.join(', ')}`);
  }

  const text = parts.join('\n\n');

  if (text.length < 50) {
    // Not enough content to generate meaningful embedding
    throw new Error('Insufficient candidate data for embedding generation');
  }

  return generateEmbedding(text);
}

/**
 * Generate embedding for a job based on its description and keywords
 */
export async function generateJobEmbedding(job: {
  title: string;
  description?: string | null;
  location?: string | null;
  keywords?: { keyword: string; expansions: string[] }[];
}): Promise<number[]> {
  const parts: string[] = [];

  // Job title
  parts.push(`Job Title: ${job.title}`);

  // Location context
  if (job.location) {
    parts.push(`Location: ${job.location}`);
  }

  // Description is most important
  if (job.description) {
    parts.push(`Description: ${job.description}`);
  }

  // Keywords with expansions
  if (job.keywords && job.keywords.length > 0) {
    const keywordList = job.keywords
      .map((k) => [k.keyword, ...k.expansions].join(', '))
      .join('; ');
    parts.push(`Required Skills/Keywords: ${keywordList}`);
  }

  const text = parts.join('\n\n');

  if (text.length < 30) {
    throw new Error('Insufficient job data for embedding generation');
  }

  return generateEmbedding(text);
}

/**
 * AI text refinement types
 */
export type RefineTextAction =
  | 'refine'          // General improvement
  | 'grammar'         // Fix grammar & spelling
  | 'concise'         // Make more concise
  | 'detailed';       // Make more detailed

/**
 * Refine interview feedback text using AI
 */
export async function refineText(
  text: string,
  action: RefineTextAction
): Promise<string> {
  const openai = getOpenAI();

  const prompts: Record<RefineTextAction, string> = {
    refine: `Improve this interview feedback to be clearer, more professional, and better structured. Maintain the original meaning and key observations:`,
    grammar: `Fix any grammar, spelling, and punctuation errors in this interview feedback. Keep the original tone and content:`,
    concise: `Make this interview feedback more concise while preserving all key observations and conclusions. Remove redundancy and filler words:`,
    detailed: `Expand this interview feedback with more specific details and professional language. Add structure if helpful, but don't invent new observations:`,
  };

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an assistant helping recruiters write clear, professional interview feedback.
Your task is to improve the text while keeping it authentic to what the interviewer observed.
- Keep the same perspective (first person if used)
- Don't invent new observations or conclusions
- Maintain a professional but human tone
- Preserve specific examples mentioned
- Return ONLY the improved text, no explanations or meta-commentary`,
      },
      {
        role: 'user',
        content: `${prompts[action]}

${text}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content?.trim() || text;
}
