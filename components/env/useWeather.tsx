'use client';
// Local "Fetch weather" control. Calls the public weather API directly (lib/weather, agent D).
// Kept independent of components/env/WeatherButton.tsx, which another agent owns.
import { useState } from 'react';
import { fetchGameWeather } from '@/lib/weather';
import type { Game, GameEnv } from '@/lib/types';

export function useWeather() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (g: Game, onApply: (env: GameEnv) => void) => {
    setBusy(true);
    setMsg(null);
    try {
      const w = await fetchGameWeather({ date: g.date, kickoff: g.env?.kickoff, location: g.location, venue: g.venue, lat: g.env?.lat, lon: g.env?.lon });
      onApply({ ...(g.env ?? {}), ...w });
      setMsg({ ok: true, text: `Weather filled${w.tempF != null ? `: ${Math.round(w.tempF)}°F` : ''}.` });
    } catch (e) {
      setMsg({ ok: false, text: `Weather unavailable (${(e as Error).message}).` });
    } finally {
      setBusy(false);
    }
  };
  return { busy, msg, run };
}

export function FetchWeather({ game, onApply, force }: { game: Game; onApply: (env: GameEnv) => void; force?: boolean }) {
  const { busy, msg, run } = useWeather();
  const has = game.env?.tempF != null;
  return (
    <span className="form" style={{ gap: 6 }}>
      <button type="button" className="btn" disabled={busy}
        title={has && !force ? 'Overwrites the conditions already entered' : undefined} onClick={() => run(game, onApply)}>
        {busy ? 'Fetching…' : has ? 'Refetch weather' : 'Fetch weather'}
      </button>
      {msg && <span className={msg.ok ? 'ok' : 'err'} style={{ fontSize: 12 }}>{msg.text}</span>}
    </span>
  );
}
