'use client';
// "Fetch weather" button. OWNED BY AGENT D (used by the Environment / Add-data UI).
// Never saves: it calls onApply with the merged env and the caller persists via lib/data/mutations.
import { useState } from 'react';
import type { Game, GameEnv } from '@/lib/types';
import { fetchGameWeather, mergeEnv } from '@/lib/weather';

export interface WeatherButtonProps {
  game: Pick<Game, 'date' | 'location' | 'venue' | 'env'>;
  onApply: (env: GameEnv) => void;
  /** Overwrite existing weather values instead of only filling empty ones. */
  force?: boolean;
  disabled?: boolean;
}

export default function WeatherButton({ game, onApply, force = false, disabled }: WeatherButtonProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ msg: string; err?: boolean } | null>(null);

  async function run() {
    setBusy(true);
    setStatus({ msg: 'Fetching…' });
    try {
      const e = game.env;
      const fetched = await fetchGameWeather({
        date: game.date,
        kickoff: e?.kickoff || undefined,
        location: game.location,
        venue: game.venue,
        lat: e?.lat,
        lon: e?.lon,
      });
      onApply(mergeEnv(e, fetched, force));
      const parts = [
        fetched.tempF != null ? `${Math.round(fetched.tempF)}°F` : null,
        fetched.dewF != null ? `dew ${Math.round(fetched.dewF)}°` : null,
        fetched.uv != null ? `UV ${fetched.uv}` : null,
      ].filter(Boolean);
      setStatus({ msg: `${parts.join(' · ') || 'No data'} at ${e?.kickoff || fetched.kickoff}${e?.kickoff ? '' : ' (default kickoff)'}` });
    } catch (err) {
      setStatus({ msg: (err as Error).message || 'Weather lookup failed', err: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" className="btn" onClick={run} disabled={busy || disabled}>
        {busy ? 'Fetching…' : 'Fetch weather'}
      </button>
      {status && (
        <span className={status.err ? undefined : 'muted'} style={status.err ? { color: 'var(--loss)' } : undefined} role="status">
          {status.msg}
        </span>
      )}
    </span>
  );
}
