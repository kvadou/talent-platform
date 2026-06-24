'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';
import { PhoneIcon, PhoneXMarkIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';

type State = 'idle' | 'connecting' | 'active' | 'ended' | 'error';

/**
 * Live browser voice call to the AI screening agent (Retell). Connects to the
 * same agent the production phone screen uses; speak as the selected persona.
 */
export function VoiceCallWidget({ personaId }: { personaId: string }) {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [caption, setCaption] = useState('');
  const [agentTalking, setAgentTalking] = useState(false);
  const clientRef = useRef<RetellWebClient | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      cleanup();
      clientRef.current?.stopCall();
    },
    [cleanup]
  );

  // Reset when the persona changes.
  useEffect(() => {
    clientRef.current?.stopCall();
    cleanup();
    setState('idle');
    setError(null);
    setCaption('');
    setElapsed(0);
  }, [personaId, cleanup]);

  async function start() {
    setError(null);
    setCaption('');
    setState('connecting');
    try {
      const res = await fetch('/api/screening/playground/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Failed to start (${res.status})`);
      }
      const { accessToken } = await res.json();

      const client = new RetellWebClient();
      clientRef.current = client;
      client.on('call_started', () => {
        setState('active');
        setElapsed(0);
        timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      });
      client.on('call_ended', () => {
        cleanup();
        setState('ended');
      });
      client.on('error', (err: Error) => {
        cleanup();
        clientRef.current?.stopCall();
        setError(err?.message || 'Call error');
        setState('error');
      });
      client.on('agent_start_talking', () => setAgentTalking(true));
      client.on('agent_stop_talking', () => setAgentTalking(false));
      client.on(
        'update',
        (u: { transcript?: Array<{ role: string; content: string }> }) => {
          if (!u.transcript?.length) return;
          const lastAgent = [...u.transcript]
            .reverse()
            .find((t) => t.role === 'agent');
          if (lastAgent) setCaption(lastAgent.content);
        }
      );
      await client.startCall({ accessToken, sampleRate: 24000 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start call');
      setState('error');
    }
  }

  function end() {
    clientRef.current?.stopCall();
  }

  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <MicrophoneIcon className="h-4 w-4 text-brand-purple" />
          Voice screen with Bella
        </div>
        {state === 'active' && (
          <span className="text-sm tabular-nums text-gray-500">
            {mm}:{ss}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        A real browser voice call to the same AI agent used for production phone
        screens. Allow microphone access, then speak as the candidate.
      </p>

      {error && (
        <div className="mt-3 rounded-lg border border-brand-pink/30 bg-brand-pink/10 px-3 py-2 text-sm text-brand-pink">
          {error}
        </div>
      )}

      {(state === 'idle' || state === 'error') && (
        <Button onClick={start} className="mt-4" size="sm">
          <PhoneIcon className="mr-2 h-4 w-4" />
          Start voice call
        </Button>
      )}
      {state === 'connecting' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand-purple" />
          Connecting…
        </div>
      )}
      {state === 'active' && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span
              className={`h-2 w-2 rounded-full ${
                agentTalking ? 'bg-brand-purple' : 'bg-gray-300'
              }`}
            />
            {agentTalking ? 'Bella is speaking' : 'Listening — speak now'}
          </div>
          {caption && (
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {caption}
            </div>
          )}
          <Button onClick={end} variant="danger" size="sm">
            <PhoneXMarkIcon className="mr-2 h-4 w-4" />
            End call
          </Button>
        </div>
      )}
      {state === 'ended' && (
        <div className="mt-4 space-y-3">
          <div className="text-sm text-gray-600">
            Call ended. In production, Bella scores the transcript on six
            dimensions and routes the candidate automatically.
          </div>
          <Button onClick={start} variant="outline" size="sm">
            <PhoneIcon className="mr-2 h-4 w-4" />
            Call again
          </Button>
        </div>
      )}
    </div>
  );
}
