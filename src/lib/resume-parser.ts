import { getOpenAI } from './openai';
import { downloadResumeBuffer } from './s3';
import { extractText } from 'unpdf';

export interface ParsedResume {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  location: string | null;
  summary: string | null;
  skills: string[];
  experience: {
    title: string;
    company: string;
    duration: string;
    description: string;
  }[];
  education: {
    degree: string;
    school: string;
    year: string;
  }[];
  rawText: string;
}

/**
 * Extract text from a PDF buffer using unpdf
 * This is a pure Node.js solution that works in serverless environments
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    // Convert Buffer to Uint8Array (unpdf requires Uint8Array, not Buffer)
    const uint8Array = new Uint8Array(buffer);

    // Use unpdf which works in Node.js without DOM dependencies
    // text is an array of strings (one per page)
    const { text, totalPages } = await extractText(uint8Array);

    // Join all pages with double newlines
    const fullText = Array.isArray(text) ? text.join('\n\n') : text;

    void totalPages;

    return fullText;
  } catch (error) {
    console.error('[Resume Parser] PDF parsing error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Parse resume text using GPT-4 to extract structured information
 */
async function parseResumeWithAI(resumeText: string): Promise<Omit<ParsedResume, 'rawText'>> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a resume parser. Extract candidate information from the resume text.
Return a JSON object with these fields (use null if not found):
- firstName: string | null
- lastName: string | null
- email: string | null
- phone: string | null (format as provided)
- linkedinUrl: string | null
- location: string | null (city, state or general location)
- summary: string | null (brief professional summary, max 200 chars)
- skills: string[] (list of technical and professional skills)
- experience: array of { title, company, duration, description } (most recent 3)
- education: array of { degree, school, year }

Rules:
- Return ONLY valid JSON, no markdown or explanation
- For phone numbers, keep original format
- For LinkedIn, include full URL
- Keep skills concise (e.g., "JavaScript" not "JavaScript programming language")
- For experience duration, format as "Jan 2020 - Present" or similar
- Experience descriptions should be 1-2 sentences max`,
      },
      {
        role: 'user',
        content: `Parse this resume:\n\n${resumeText.slice(0, 15000)}`, // Limit to ~15k chars
      },
    ],
    temperature: 0.1,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content?.trim() || '{}';

  try {
    // Clean up potential markdown code blocks
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanedContent);

    return {
      firstName: parsed.firstName || null,
      lastName: parsed.lastName || null,
      email: parsed.email || null,
      phone: parsed.phone || null,
      linkedinUrl: parsed.linkedinUrl || null,
      location: parsed.location || null,
      summary: parsed.summary || null,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
    };
  } catch (error) {
    console.error('Failed to parse AI response:', content, error);
    // Return empty structure on parse failure
    return {
      firstName: null,
      lastName: null,
      email: null,
      phone: null,
      linkedinUrl: null,
      location: null,
      summary: null,
      skills: [],
      experience: [],
      education: [],
    };
  }
}

/**
 * Parse a resume from S3 and extract candidate information
 * @param s3Key - The S3 key (path) of the resume file
 * @returns Parsed resume data
 */
export async function parseResume(s3Key: string): Promise<ParsedResume> {
  // Download the resume from S3
  const buffer = await downloadResumeBuffer(s3Key);

  // Extract text based on file type
  let resumeText: string;

  if (s3Key.toLowerCase().endsWith('.pdf')) {
    resumeText = await extractTextFromPdf(buffer);
  } else if (s3Key.toLowerCase().endsWith('.docx') || s3Key.toLowerCase().endsWith('.doc')) {
    // For Word docs, we'll try to extract text directly
    // The pdf-parse library doesn't handle docx, but we can try basic text extraction
    // or just pass the buffer content
    resumeText = buffer.toString('utf-8');
    // Clean up binary characters for docx
    resumeText = resumeText.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
  } else {
    // Assume plain text
    resumeText = buffer.toString('utf-8');
  }

  if (!resumeText || resumeText.length < 50) {
    throw new Error('Could not extract sufficient text from resume');
  }

  // Parse with AI
  const parsed = await parseResumeWithAI(resumeText);

  return {
    ...parsed,
    rawText: resumeText,
  };
}

/**
 * Quick extraction of just contact info (faster, cheaper)
 * Used for form auto-fill without full parsing
 */
export async function extractContactInfo(s3Key: string): Promise<{
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
}> {
  const buffer = await downloadResumeBuffer(s3Key);

  let resumeText: string;
  if (s3Key.toLowerCase().endsWith('.pdf')) {
    resumeText = await extractTextFromPdf(buffer);
  } else {
    resumeText = buffer.toString('utf-8');
    resumeText = resumeText.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are extracting contact information from a resume. The text may contain icons, emojis, or special characters near contact info.

Look for:
- Name: Usually at the top, the person's full name
- Email: Look for patterns like name@domain.com, may have email icon nearby
- Phone: Look for phone number patterns (XXX-XXX-XXXX, (XXX) XXX-XXXX, etc.), may have phone icon
- LinkedIn: Look for linkedin.com/in/ URLs

Return ONLY a valid JSON object with these exact fields:
{
  "firstName": "string or null",
  "lastName": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "linkedinUrl": "string or null"
}

Be thorough - scan the entire text for contact patterns. Phone numbers and emails are often at the very beginning.`,
      },
      {
        role: 'user',
        content: resumeText.slice(0, 5000), // First 5k chars should have contact info
      },
    ],
    temperature: 0,
    max_tokens: 300,
  });

  const content = response.choices[0]?.message?.content?.trim() || '{}';

  try {
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanedContent);
    const result = {
      firstName: parsed.firstName || null,
      lastName: parsed.lastName || null,
      email: parsed.email || null,
      phone: parsed.phone || null,
      linkedinUrl: parsed.linkedinUrl || null,
    };
    return result;
  } catch (parseError) {
    console.error('[Resume Parser] Failed to parse AI response:', content, parseError);
    return {
      firstName: null,
      lastName: null,
      email: null,
      phone: null,
      linkedinUrl: null,
    };
  }
}
