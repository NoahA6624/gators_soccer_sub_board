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
  const lastFresh = useRef<Game | null>(null);

  useEffect(() => {
    // New contest: never merge one game's edits/events into another.
    prev.current = null;
    lastFresh.current = null;
    setData(null);
    setError(null);
    if (!gameId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      let next: number | null = null;
      try {
        const qs = new URLSearchParams({ gameId, ...(date ? { date } : {}) });
        const res = await fetch(`/api/ncaa?${qs}`, { cache: 'no-store' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          // Client errors (bad id, signed out, not a Florida game) won't fix themselves: stop polling.
          // 404 = no data yet (pre-game) and 5xx = upstream trouble: retry after the back-off.
          if (res.status >= 400 && res.status < 500 && res.status !== 404 && res.status !== 429) {
            if (!stop) setError(body.error || `HTTP ${res.status}`);
            return;
          }
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const payload = body as NcaaGamePayload;
        if (stop) return;
        const game = prev.current ? refreshLiveGame(prev.current, payload.game, lastFresh.current ?? undefined) : payload.game;
        prev.current = game;
        lastFresh.current = payload.game;
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
