'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PaperAirplaneIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  MicrophoneIcon,
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { VoiceCallWidget } from './VoiceCallWidget';

type Persona = {
  id: string;
  name: string;
  tagline: string;
  summary: string;
  difficulty: 'strong' | 'mixed' | 'knockout';
};

const PERSONAS: Persona[] = [
  {
    id: 'maya',
    name: 'Maya Chen',
    tagline: 'Strong fit — rated player, teaches kids',
    summary:
      'USCF-rated ~1600, three years coaching elementary chess clubs, fully available, has a car.',
    difficulty: 'strong',
  },
  {
    id: 'jordan',
    name: 'Jordan Blake',
    tagline: 'Mixed signal — casual player, limited hours',
    summary:
      'Casual club player, tutored a few neighbors, unsure about weekends, no formal teaching experience.',
    difficulty: 'mixed',
  },
  {
    id: 'sam',
    name: 'Sam Rivera',
    tagline: 'Knockout — no weekend availability',
    summary:
      'Great with kids, but works every weekend and cannot make required Saturday sessions.',
    difficulty: 'knockout',
  },
];

const DIFFICULTY_STYLE: Record<Persona['difficulty'], string> = {
  strong: 'bg-brand-green/10 text-brand-green',
  mixed: 'bg-brand-yellow/15 text-brand-orange',
  knockout: 'bg-brand-pink/10 text-brand-pink',
};

type ChatMsg = {
  role: 'ai' | 'candidate';
  content: string;
  score?: number;
  analysis?: string;
  knockout?: boolean;
};

type FinalResult = {
  finalScore: number;
  recommendation: string;
  recommendationLabel: string;
  rationale: string;
  knockout: boolean;
};

function scoreColor(score: number): string {
  if (score >= 75) return 'text-brand-green';
  if (score >= 50) return 'text-brand-orange';
  return 'text-brand-pink';
}

export function ScreeningPlayground() {
  const [mode, setMode] = useState<'chat' | 'voice'>('voice');
  const [persona, setPersona] = useState<Persona>(PERSONAS[0]);

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [questionOrder, setQuestionOrder] = useState(1);
  const [scores, setScores] = useState<number[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<FinalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  function resetChat() {
    setMessages([]);
    setQuestionOrder(1);
    setScores([]);
    setInput('');
    setStarted(false);
    setDone(false);
    setResult(null);
    setError(null);
  }

  // Reset the conversation whenever the persona changes.
  useEffect(() => {
    resetChat();
  }, [persona.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function startChat() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/screening/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', personaId: persona.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');
      setMessages([{ role: 'ai', content: data.aiMessage }]);
      setQuestionOrder(data.questionOrder);
      setStarted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const answer = input.trim();
    if (!answer || loading || done) return;
    setError(null);
    setInput('');
    setMessages((m) => [...m, { role: 'candidate', content: answer }]);
    setLoading(true);
    try {
      const res = await fetch('/api/screening/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'turn',
          personaId: persona.id,
          questionOrder,
          answer,
          priorScores: scores,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Screening failed');

      // Attach the score/analysis to the candidate message we just sent.
      setMessages((m) => {
        const copy = [...m];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === 'candidate' && copy[i].score === undefined) {
            copy[i] = {
              ...copy[i],
              score: data.score,
              analysis: data.analysis,
              knockout: data.knockout,
            };
            break;
          }
        }
        copy.push({ role: 'ai', content: data.aiMessage });
        return copy;
      });

      if (!data.knockout && typeof data.score === 'number') {
        setScores((s) => [...s, data.score]);
      }
      if (data.done) {
        setDone(true);
        setResult({
          finalScore: data.finalScore,
          recommendation: data.recommendation,
          recommendationLabel: data.recommendationLabel,
          rationale: data.rationale,
          knockout: Boolean(data.knockout),
        });
      } else {
        setQuestionOrder(data.questionOrder);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Screening failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Persona selector */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Choose a candidate to role-play
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {PERSONAS.map((p) => {
            const active = p.id === persona.id;
            return (
              <button
                key={p.id}
                onClick={() => setPersona(p)}
                className={`rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-brand-purple ring-2 ring-brand-purple/30 bg-brand-purple/5'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${DIFFICULTY_STYLE[p.difficulty]}`}
                  >
                    {p.difficulty}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500">{p.tagline}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        <button
          onClick={() => setMode('voice')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === 'voice' ? 'bg-white text-brand-purple shadow-sm' : 'text-gray-500'
          }`}
        >
          <MicrophoneIcon className="h-4 w-4" />
          Voice screen
        </button>
        <button
          onClick={() => setMode('chat')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === 'chat' ? 'bg-white text-brand-purple shadow-sm' : 'text-gray-500'
          }`}
        >
          <ChatBubbleLeftRightIcon className="h-4 w-4" />
          Chat screen
        </button>
      </div>

      {mode === 'voice' ? (
        <VoiceCallWidget personaId={persona.id} />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          {/* Transcript */}
          <div ref={scrollRef} className="max-h-[420px] min-h-[260px] space-y-4 overflow-y-auto p-4">
            {!started && (
              <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-purple/10">
                  <SparklesIcon className="h-6 w-6 text-brand-purple" />
                </div>
                <p className="mt-3 max-w-sm text-sm text-gray-500">
                  Bella runs a live AI screen for the <strong>Chess Instructor</strong>{' '}
                  role — asking questions, scoring each answer, and recommending a
                  decision. Answer as <strong>{persona.name}</strong>.
                </p>
                <Button onClick={startChat} className="mt-4" disabled={loading}>
                  <SparklesIcon className="mr-2 h-4 w-4" />
                  {loading ? 'Starting…' : 'Start screening'}
                </Button>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'ai' ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-[80%] ${m.role === 'candidate' ? 'text-right' : ''}`}>
                  <div
                    className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                      m.role === 'ai'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-brand-purple text-white'
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.role === 'ai' && (
                    <div className="mt-1 pl-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      Bella
                    </div>
                  )}
                  {m.role === 'candidate' && m.score !== undefined && (
                    <div className="mt-1 flex items-center justify-end gap-2 pr-1">
                      <span className={`text-xs font-semibold ${scoreColor(m.score)}`}>
                        {m.knockout ? 'Knockout' : `${m.score}/100`}
                      </span>
                      {m.analysis && (
                        <span className="max-w-[260px] truncate text-[11px] text-gray-400">
                          {m.analysis}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && started && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-gray-100 px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Result banner */}
          {result && (
            <div
              className={`border-t px-4 py-3 ${
                result.recommendation === 'REJECT' || result.recommendation === 'NO'
                  ? 'bg-brand-pink/5'
                  : 'bg-brand-green/5'
              }`}
            >
              <div className="flex items-center gap-2">
                {result.recommendation === 'REJECT' || result.recommendation === 'NO' ? (
                  <XCircleIcon className="h-5 w-5 text-brand-pink" />
                ) : (
                  <CheckCircleIcon className="h-5 w-5 text-brand-green" />
                )}
                <span className="text-sm font-semibold text-gray-900">
                  {result.recommendationLabel}
                </span>
                {!result.knockout && (
                  <span className={`ml-auto text-sm font-bold ${scoreColor(result.finalScore)}`}>
                    {result.finalScore}/100
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">{result.rationale}</p>
            </div>
          )}

          {/* Composer */}
          {started && (
            <div className="border-t p-3">
              {error && (
                <div className="mb-2 rounded-lg border border-brand-pink/30 bg-brand-pink/10 px-3 py-2 text-xs text-brand-pink">
                  {error}
                </div>
              )}
              {done ? (
                <Button onClick={resetChat} variant="outline" className="w-full" size="sm">
                  <ArrowPathIcon className="mr-2 h-4 w-4" />
                  Run another screen
                </Button>
              ) : (
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={2}
                    placeholder={`Answer as ${persona.name}…`}
                    disabled={loading}
                    className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/30"
                  />
                  <Button onClick={send} disabled={loading || !input.trim()} size="sm">
                    <PaperAirplaneIcon className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'chat' && started && !done && (
        <p className="text-center text-xs text-gray-400">
          Question {questionOrder} of 5 · powered by gpt-4o-mini
        </p>
      )}
    </div>
  );
}
