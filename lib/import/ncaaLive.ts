'use client';
// Client hook: polls /api/ncaa?gameId= every 60s while the game is live, stops at final,
// backs off (5 min) after an error. The server caches upstream, so many viewers ≠ many ncaa.com calls.
import { useEffect, useRef, useState } from 'react';
import type { Game } from '@/lib/types';
import type { FloridaContest, NcaaConfidence } from './ncaaCom';
import { refreshLiveGame } from './ncaaCom';

export interface NcaaGamePayload {
  game: Game;
  warnings: string[];
  confidence: NcaaConfidence;
  contest: FloridaContest | null;
  live: boolean;
  pollMs: number | null;
}

export function useNcaaLiveGame(gameId: string | null, date?: string) {
  const [data, setData] = useState<NcaaGamePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prev = useRef<Game | null>(null);

  useEffect(() => {
    if (!gameId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      let next: number | null = null;
      try {
        const qs = new URLSearchParams({ gameId, ...(date ? { date } : {}) });
        const res = await fetch(`/api/ncaa?${qs}`, { cache: 'no-store' });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        const payload = body as NcaaGamePayload;
        const game = prev.current ? refreshLiveGame(prev.current, payload.game) : payload.game;
        prev.current = game;
        if (!stop) {
          setData({ ...payload, game });
          setError(null);
        }
        next = payload.pollMs;
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : String(e));
        next = 5 * 60_000;
      }
      if (!stop && next) timer = setTimeout(tick, next);
    };
    tick();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [gameId, date]);

  /** Let the review UI push manual edits so the next refresh keeps them. */
  const setEdited = (g: Game) => {
    prev.current = g;
    setData((d) => (d ? { ...d, game: g } : d));
  };
  return { data, error, setEdited };
}
