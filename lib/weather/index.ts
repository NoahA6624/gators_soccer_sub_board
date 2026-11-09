// Weather client API. OWNED BY AGENT D. Calls /api/weather (server proxies Open-Meteo + caches).
import type { GameEnv } from '@/lib/types';

export interface WeatherQuery { date: string; kickoff?: string; location?: string; venue?: string; lat?: number; lon?: number }

export { mergeEnv } from './merge';

/** Returns env fields at kickoff hour (tempF, dewF, rh, uv, windMph, precipIn, lat, lon, src:'open-meteo'). */
export async function fetchGameWeather(q: WeatherQuery): Promise<GameEnv> {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v != null && v !== '') p.set(k, String(v));
  const res = await fetch(`/api/weather?${p.toString()}`, { headers: { accept: 'application/json' } });
  let body: { env?: GameEnv; error?: string } = {};
  try { body = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || !body.env) throw new Error(body.error || `Weather request failed (HTTP ${res.status})`);
  return body.env;
}
