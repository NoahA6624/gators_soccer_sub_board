// Merge fetched weather into a game's existing env. OWNED BY AGENT D. Pure.
import type { GameEnv } from '@/lib/types';

export const WEATHER_FIELDS = ['tempF', 'dewF', 'rh', 'uv', 'windMph', 'precipIn'] as const;

/**
 * Fetched values fill only null/missing fields; with `force` they overwrite.
 * An existing kickoff (and its kickoffSrc) is always preserved.
 */
export function mergeEnv(existing: GameEnv | undefined, fetched: GameEnv, force = false): GameEnv {
  const cur: GameEnv = { ...(existing ?? {}) };
  const out: GameEnv = { ...cur };
  let filled = 0, kept = 0;
  for (const k of WEATHER_FIELDS) {
    const has = cur[k] != null;
    if (fetched[k] != null && (force || !has)) { out[k] = fetched[k]; filled++; }
    else if (has) kept++;
  }
  if (cur.kickoff) { out.kickoff = cur.kickoff; out.kickoffSrc = cur.kickoffSrc; }
  else if (fetched.kickoff) { out.kickoff = fetched.kickoff; out.kickoffSrc = fetched.kickoffSrc; }
  if (fetched.lat != null && (force || cur.lat == null)) { out.lat = fetched.lat; out.lon = fetched.lon; }
  if (filled) out.src = kept ? `${cur.src && cur.src !== 'open-meteo' ? cur.src : 'manual'}+open-meteo` : 'open-meteo';
  if (out.kickoffSrc === undefined) delete out.kickoffSrc;
  return out;
}
