import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  QUESTIONS,
  getPersona,
  greeting,
  evaluateAnswer,
  recommendationFor,
  completionMessage,
  knockoutMessage,
  RECOMMENDATION_LABEL,
} from '@/lib/screening/playground-engine';

// Public demo route (the whole app is a public portfolio demo). Stateless:
// the client holds the transcript + prior per-answer scores and posts them
// back each turn, so the Playground works regardless of seed state.
export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('start'),
    personaId: z.string().min(1),
  }),
  z.object({
    action: z.literal('turn'),
    personaId: z.string().min(1),
    // 1-based order of the question this answer responds to.
    questionOrder: z.number().int().min(1).max(QUESTIONS.length),
    answer: z.string().min(1).max(4000),
    priorScores: z.array(z.number()).default([]),
  }),
]);

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'AI screening is not configured (missing OpenAI key).' },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const persona = getPersona(parsed.data.personaId);
  const firstName = (persona?.name || 'there').split(/\s+/)[0];

  try {
    if (parsed.data.action === 'start') {
      return NextResponse.json({
        aiMessage: greeting(persona),
        questionOrder: 1,
        done: false,
      });
    }

    const { questionOrder, answer, priorScores } = parsed.data;
    const question = QUESTIONS.find((q) => q.order === questionOrder);
    if (!question) {
      return NextResponse.json({ error: 'Unknown question' }, { status: 400 });
    }

    const evaluation = await evaluateAnswer(question, answer, persona);

    // Knockout — end immediately with a REJECT recommendation.
    if (evaluation.knockout) {
      return NextResponse.json({
        aiMessage: knockoutMessage(firstName),
        score: 0,
        analysis: evaluation.analysis,
        knockout: true,
        knockoutReason: evaluation.reason,
        done: true,
        questionOrder,
        finalScore: 0,
        recommendation: 'REJECT',
        recommendationLabel: RECOMMENDATION_LABEL.REJECT,
        rationale: `Knockout on question ${questionOrder}: ${evaluation.reason}`,
      });
    }

    const scores = [...priorScores, evaluation.score];
    const nextQuestion = QUESTIONS.find((q) => q.order === questionOrder + 1);

    // More questions remain — acknowledge and ask the next one.
    if (nextQuestion) {
      return NextResponse.json({
        aiMessage: `${evaluation.transition}\n\n${nextQuestion.text}`,
        score: evaluation.score,
        analysis: evaluation.analysis,
        knockout: false,
        done: false,
        questionOrder: nextQuestion.order,
      });
    }

    // Screen complete — weighted (here, simple mean) score → recommendation.
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const rec = recommendationFor(avg);
    return NextResponse.json({
      aiMessage: completionMessage(firstName, rec, avg),
      score: evaluation.score,
      analysis: evaluation.analysis,
      knockout: false,
      done: true,
      questionOrder,
      finalScore: avg,
      recommendation: rec,
      recommendationLabel: RECOMMENDATION_LABEL[rec],
      rationale: `Mean screening score ${avg}/100 across ${scores.length} answers → ${rec}.`,
    });
  } catch (err) {
    console.error('[screening playground] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Screening failed' },
      { status: 500 }
    );
  }
}
