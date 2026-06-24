/**
 * AI Screening Playground engine.
 *
 * A self-contained, stateless mirror of the production Bella chat screener:
 * Bella asks a fixed set of role screening questions one at a time, scores each
 * answer with gpt-4o-mini, can knock a candidate out on a hard requirement, and
 * produces a weighted recommendation at the end.
 *
 * Stateless by design — no DB tables, no migrations. The client holds the
 * transcript and prior per-answer scores and posts them back each turn, so the
 * Playground keeps working regardless of demo-seed state. The voice channel
 * (Retell) reuses the same role + personas.
 */
import { getOpenAI } from '@/lib/openai';

export const PLAYGROUND_ROLE = 'Chess Instructor';
export const EMPLOYER_NAME = 'Story Time Chess';

export type PlaygroundPersona = {
  id: string;
  name: string;
  tagline: string;
  summary: string;
  difficulty: 'strong' | 'mixed' | 'knockout';
};

/**
 * Candidate personas the tester role-plays. The persona sets Bella's greeting
 * context (name + summary) and is passed to the voice agent as dynamic vars;
 * scoring is always on the answer text the tester actually types/speaks.
 */
export const PERSONAS: PlaygroundPersona[] = [
  {
    id: 'maya',
    name: 'Maya Chen',
    tagline: 'Strong fit — rated player, teaches kids',
    summary:
      'USCF-rated ~1600, three years coaching elementary chess clubs, fully available after school and weekends, has a car.',
    difficulty: 'strong',
  },
  {
    id: 'jordan',
    name: 'Jordan Blake',
    tagline: 'Mixed signal — casual player, limited hours',
    summary:
      'Casual club player, tutored a few neighbors, available some afternoons but unsure about weekends, no formal teaching experience.',
    difficulty: 'mixed',
  },
  {
    id: 'sam',
    name: 'Sam Rivera',
    tagline: 'Knockout path — no weekend availability',
    summary:
      'Enthusiastic and great with kids, but works another job every weekend and cannot make the required Saturday sessions.',
    difficulty: 'knockout',
  },
];

export function getPersona(id: string): PlaygroundPersona | undefined {
  return PERSONAS.find((p) => p.id === id);
}

export type ScreeningQuestion = {
  order: number;
  text: string;
  /** When true, a clear failure here ends the screen immediately. */
  knockout?: boolean;
  /** Plain-language pass/fail bar the model scores against. */
  criteria: string;
};

export const QUESTIONS: ScreeningQuestion[] = [
  {
    order: 1,
    text: "Thanks for your interest in coaching with Story Time Chess! To start — what's your experience teaching or coaching chess, especially with children?",
    criteria:
      'Reward concrete experience teaching/coaching, particularly with kids. Generic or no experience scores low. Not a knockout.',
  },
  {
    order: 2,
    text: 'How would you describe your own chess strength? A rating, tournament history, or how you typically perform is all helpful.',
    criteria:
      'Reward a credible playing strength (rating, tournament play, or clear competitive ability). Vague or beginner-level scores low. Not a knockout.',
  },
  {
    order: 3,
    text: 'Our instructors run after-school clubs and Saturday morning sessions. Are you available on weekends, specifically Saturday mornings?',
    knockout: true,
    criteria:
      'Saturday-morning availability is REQUIRED. A clear "no" / cannot do Saturdays is a knockout. "Yes" or workable availability passes.',
  },
  {
    order: 4,
    text: 'Working with young kids takes patience and energy. Tell me about a time you kept a group of children engaged.',
    criteria:
      'Reward a specific, believable example showing patience and engagement with children. Generic answers score low. Not a knockout.',
  },
  {
    order: 5,
    text: 'Last one — we provide a structured curriculum. How comfortable are you following a set lesson plan while adapting to each kid?',
    criteria:
      'Reward willingness to follow a curriculum while adapting to students. Rigidity or unwillingness scores low. Not a knockout.',
  },
];

export type AnswerEvaluation = {
  score: number;
  knockout: boolean;
  reason: string | null;
  analysis: string;
  transition: string;
};

const SCORE_SYS = `You are Bella, an AI recruiter at ${EMPLOYER_NAME} screening candidates for a ${PLAYGROUND_ROLE} role.
Evaluate the candidate's answer to ONE screening question. Be fair but discerning — this gates a real hiring pipeline.
Respond with ONLY a JSON object, no markdown, with these keys:
{
  "score": integer 0-100 (how well the answer meets the criteria),
  "knockout": boolean (true ONLY if the question is a knockout AND the answer clearly fails the hard requirement),
  "reason": string or null (if knockout, one short sentence why; else null),
  "analysis": string (<=180 chars, what stood out about the answer),
  "transition": string (<=160 chars, a warm one-sentence acknowledgement of their answer to lead into the next question — do NOT include the next question)
}`;

/** Score a single candidate answer against its question. */
export async function evaluateAnswer(
  question: ScreeningQuestion,
  answer: string,
  persona: PlaygroundPersona | undefined
): Promise<AnswerEvaluation> {
  const openai = getOpenAI();
  const user = `Candidate: ${persona?.name ?? 'Candidate'}${
    persona ? ` — ${persona.summary}` : ''
  }
Question (${question.knockout ? 'KNOCKOUT' : 'scored'}): ${question.text}
Pass/fail criteria: ${question.criteria}
Candidate's answer: "${answer.slice(0, 2000)}"`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SCORE_SYS },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
    max_tokens: 300,
    response_format: { type: 'json_object' },
  });

  const raw = res.choices[0]?.message?.content?.trim() || '{}';
  let parsed: Partial<AnswerEvaluation> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const score = clampScore(parsed.score);
  const knockout = Boolean(question.knockout) && parsed.knockout === true;
  return {
    score: knockout ? 0 : score,
    knockout,
    reason: knockout ? parsed.reason || 'Failed a required qualification.' : null,
    analysis:
      typeof parsed.analysis === 'string' && parsed.analysis.trim()
        ? parsed.analysis.trim().slice(0, 200)
        : 'Answer recorded.',
    transition:
      typeof parsed.transition === 'string' && parsed.transition.trim()
        ? parsed.transition.trim().slice(0, 180)
        : 'Thanks for sharing that.',
  };
}

function clampScore(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export type Recommendation = 'STRONG_YES' | 'YES' | 'MAYBE' | 'NO' | 'REJECT';

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  STRONG_YES: 'Strong Yes — advance to interview',
  YES: 'Yes — advance',
  MAYBE: 'Maybe — manual review',
  NO: 'No — likely pass',
  REJECT: 'Rejected — knockout',
};

export function recommendationFor(avg: number): Recommendation {
  if (avg >= 80) return 'STRONG_YES';
  if (avg >= 65) return 'YES';
  if (avg >= 50) return 'MAYBE';
  return 'NO';
}

export function greeting(persona: PlaygroundPersona | undefined): string {
  const first = (persona?.name || 'there').split(/\s+/)[0];
  return `Hi ${first}, I'm Bella, the screening assistant for ${EMPLOYER_NAME}. I'll ask you a few quick questions about coaching chess — answer naturally, and I'll let you know about next steps at the end.\n\n${QUESTIONS[0].text}`;
}

export function completionMessage(
  firstName: string,
  rec: Recommendation,
  avg: number
): string {
  if (rec === 'STRONG_YES' || rec === 'YES') {
    return `Thanks, ${firstName} — that's everything I needed. You came across really well (screening score ${avg}/100). I'm advancing you to the next round; our team will reach out to schedule an interview. 🎉`;
  }
  if (rec === 'MAYBE') {
    return `Thanks, ${firstName}. I've got what I need (screening score ${avg}/100). Your application will go to our team for a closer look — you'll hear from us soon.`;
  }
  return `Thanks for your time, ${firstName} (screening score ${avg}/100). We won't be moving forward right now, but we appreciate your interest and encourage you to apply again in the future.`;
}

export function knockoutMessage(firstName: string): string {
  return `Thanks for your honesty, ${firstName}. This role requires Saturday-morning availability, so it isn't the right fit right now. We'd love for you to apply again if your schedule changes.`;
}
