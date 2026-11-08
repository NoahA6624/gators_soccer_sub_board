// Open-Meteo client (server side, pure + testable: fetch/now/cache are injected). OWNED BY AGENT D.
// Data: Open-Meteo.com, CC BY 4.0 (attribution in the app footer). Free tier is non-commercial.
import type { GameEnv } from '@/lib/types';
import type { WeatherQuery } from './index';
import { findKnownVenue, parseCityState } from './venues';

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export type EndpointKind = 'archive' | 'forecast';

export const DEFAULT_KICKOFF = '19:00';
export const ARCHIVE_CUTOFF_DAYS = 5;
/** Forecast data for today/future dates must not be served from cache after this long. */
export const FORECAST_TTL_MS = 3 * 60 * 60 * 1000;
/** Forecast-endpoint data for recent past dates (still settling) is refreshed daily. */
export const RECENT_TTL_MS = 24 * 60 * 60 * 1000;

const HOURLY_BASE = ['temperature_2m', 'dew_point_2m', 'relative_humidity_2m', 'apparent_temperature', 'precipitation', 'wind_speed_10m'];

export class WeatherInputError extends Error { status = 400 as const; }
export class WeatherUpstreamError extends Error { status = 502 as const; constructor(public reason: string) { super(reason); } }

export interface HourlyPayload {
  kind: EndpointKind;
  lat: number;
  lon: number;
  hourly: Record<string, (number | string | null)[]> & { time: string[] };
}

export interface WeatherCache {
  get(key: string): Promise<{ payload: HourlyPayload; fetched_at: string } | null>;
  set(key: string, payload: HourlyPayload): Promise<void>;
}

export interface WeatherDeps {
  fetch: Fetch;
  now?: Date;
  apiKey?: string;
  cache?: WeatherCache | null;
}

// ---------- validation ----------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function validateQuery(q: Partial<WeatherQuery>): WeatherQuery {
  if (!q || typeof q.date !== 'string' || !DATE_RE.test(q.date) || Number.isNaN(Date.parse(q.date + 'T00:00:00Z'))) {
    throw new WeatherInputError('date must be YYYY-MM-DD');
  }
  if (q.kickoff != null && q.kickoff !== '' && !TIME_RE.test(q.kickoff)) throw new WeatherInputError('kickoff must be HH:MM');
  const hasLat = q.lat != null && (q.lat as unknown) !== '';
  const hasLon = q.lon != null && (q.lon as unknown) !== '';
  if (hasLat !== hasLon) throw new WeatherInputError('lat and lon must be given together');
  if (hasLat) {
    const lat = Number(q.lat), lon = Number(q.lon);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      throw new WeatherInputError('lat/lon out of range');
    }
  }
  return {
    date: q.date,
    kickoff: q.kickoff || undefined,
    location: q.location || undefined,
    venue: q.venue || undefined,
    lat: hasLat ? Number(q.lat) : undefined,
    lon: hasLon ? Number(q.lon) : undefined,
  };
}

// ---------- hosts ----------

function host(base: 'api' | 'archive-api' | 'geocoding-api', apiKey?: string) {
  return `https://${apiKey ? 'customer-' : ''}${base}.open-meteo.com`;
}

async function getJson(fetchFn: Fetch, url: string): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetchFn(url, { headers: { accept: 'application/json' } });
  } catch (e) {
    throw new WeatherUpstreamError(`Open-Meteo unreachable: ${(e as Error).message}`);
  }
  let body: Record<string, unknown> = {};
  try { body = (await res.json()) as Record<string, unknown>; } catch { /* non-JSON body */ }
  if (!res.ok || body.error) {
    throw new WeatherUpstreamError(typeof body.reason === 'string' ? body.reason : `Open-Meteo HTTP ${res.status}`);
  }
  return body;
}

// ---------- coordinates ----------

export interface Coords { lat: number; lon: number; via: 'explicit' | 'venue' | 'geocode' }

export async function resolveCoords(q: WeatherQuery, deps: Pick<WeatherDeps, 'fetch' | 'apiKey'>): Promise<Coords> {
  if (q.lat != null && q.lon != null) return { lat: q.lat, lon: q.lon, via: 'explicit' };
  const known = findKnownVenue(q.location, q.venue);
  if (known) return { lat: known.lat, lon: known.lon, via: 'venue' };
  const cs = parseCityState(q.location);
  const name = cs?.city ?? q.location?.trim();
  if (!name) throw new WeatherInputError('need lat/lon, a known venue, or a "City, ST" location');
  const url = `${host('geocoding-api', deps.apiKey)}/v1/search?name=${encodeURIComponent(name)}&count=1&countryCode=US` +
    (deps.apiKey ? `&apikey=${encodeURIComponent(deps.apiKey)}` : '');
  const body = await getJson(deps.fetch, url);
  const r = (body.results as { latitude: number; longitude: number }[] | undefined)?.[0];
  if (!r) throw new WeatherInputError(`could not geocode location "${q.location}"`);
  return { lat: r.latitude, lon: r.longitude, via: 'geocode' };
}

// ---------- endpoint ----------

const dayMs = 86_400_000;
const utcDay = (iso: string) => Date.parse(iso + 'T00:00:00Z');
const todayUtc = (now: Date) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

/** Archive for dates more than 5 days in the past, forecast otherwise. */
export function chooseEndpoint(date: string, now: Date = new Date()): EndpointKind {
  return (todayUtc(now) - utcDay(date)) / dayMs > ARCHIVE_CUTOFF_DAYS ? 'archive' : 'forecast';
}

export function buildWeatherUrl(kind: EndpointKind, lat: number, lon: number, date: string, apiKey?: string): string {
  const hourly = kind === 'forecast' ? [...HOURLY_BASE, 'uv_index'] : HOURLY_BASE; // archive has no uv_index
  const base = kind === 'archive' ? `${host('archive-api', apiKey)}/v1/archive` : `${host('api', apiKey)}/v1/forecast`;
  const p = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start_date: date,
    end_date: date,
    hourly: hourly.join(','),
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'auto',
  });
  if (apiKey) p.set('apikey', apiKey);
  return `${base}?${p.toString().replace(/%2C/g, ',')}`;
}

export const cacheKey = (lat: number, lon: number, date: string) => `${lat.toFixed(2)},${lon.toFixed(2)},${date}`;

/** Whether a cached payload may still be served. Archive data is final; forecast data expires. */
export function isCacheFresh(kind: EndpointKind, date: string, fetchedAt: string, now: Date = new Date()): boolean {
  if (kind === 'archive') return true;
  const age = now.getTime() - Date.parse(fetchedAt);
  if (!Number.isFinite(age) || age < 0) return false;
  const ttl = utcDay(date) >= todayUtc(now) - dayMs ? FORECAST_TTL_MS : RECENT_TTL_MS;
  return age <= ttl;
}

// ---------- hour pick ----------

const toMin = (hhmm: string) => { const m = TIME_RE.exec(hhmm); return m ? +m[1] * 60 + +m[2] : NaN; };
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const round1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);

/** Index of the hourly slot (local "YYYY-MM-DDTHH:MM") nearest kickoff on the given date. Ties go to the later hour. */
export function pickNearestHour(times: string[], date: string, kickoff: string): number {
  const target = toMin(kickoff);
  let best = -1, bestD = Infinity;
  times.forEach((t, i) => {
    if (!t.startsWith(date)) return;
    const d = Math.abs(toMin(t.slice(11, 16)) - target);
    if (d <= bestD) { best = i; bestD = d; }
  });
  return best;
}

export function envFromPayload(p: HourlyPayload, date: string, kickoff: string): GameEnv & { time?: string } {
  const i = pickNearestHour(p.hourly.time ?? [], date, kickoff);
  if (i < 0) throw new WeatherUpstreamError(`Open-Meteo returned no hourly data for ${date}`);
  const at = (k: string) => num(p.hourly[k]?.[i]);
  return {
    tempF: round1(at('temperature_2m')),
    dewF: round1(at('dew_point_2m')),
    rh: at('relative_humidity_2m'),
    uv: round1(at('uv_index')),
    windMph: round1(at('wind_speed_10m')),
    precipIn: at('precipitation'),
    lat: p.lat,
    lon: p.lon,
    src: 'open-meteo',
    time: p.hourly.time[i],
  };
}

// ---------- main ----------

async function fetchHourly(kind: EndpointKind, lat: number, lon: number, date: string, deps: WeatherDeps): Promise<HourlyPayload> {
  const body = await getJson(deps.fetch, buildWeatherUrl(kind, lat, lon, date, deps.apiKey));
  const hourly = body.hourly as HourlyPayload['hourly'] | undefined;
  if (!hourly || !Array.isArray(hourly.time)) throw new WeatherUpstreamError('Open-Meteo response missing hourly data');
  return { kind, lat, lon, hourly };
}

/** Resolve coordinates, fetch (or reuse cached) hourly data and return env at the hour nearest kickoff. */
export async function getGameWeather(input: Partial<WeatherQuery>, deps: WeatherDeps): Promise<GameEnv> {
  const q = validateQuery(input);
  const now = deps.now ?? new Date();
  const kickoff = q.kickoff ?? DEFAULT_KICKOFF;
  const { lat, lon } = await resolveCoords(q, deps);
  const key = cacheKey(lat, lon, q.date);

  let payload: HourlyPayload | null = null;
  if (deps.cache) {
    try {
      const hit = await deps.cache.get(key);
      if (hit && isCacheFresh(hit.payload.kind, q.date, hit.fetched_at, now)) payload = hit.payload;
    } catch { /* cache is best-effort */ }
  }
  if (!payload) {
    const kind = chooseEndpoint(q.date, now);
    payload = await fetchHourly(kind, lat, lon, q.date, deps);
    // ERA5 archive can lag; fall back to the forecast endpoint (historical forecast) if it came back empty.
    if (kind === 'archive' && envFromPayload(payload, q.date, kickoff).tempF == null) {
      try { payload = await fetchHourly('forecast', lat, lon, q.date, deps); } catch { /* keep archive result */ }
    }
    if (deps.cache) { try { await deps.cache.set(key, payload); } catch { /* best-effort */ } }
  }

  const env = envFromPayload(payload, q.date, kickoff);
  delete env.time;
  env.kickoff = kickoff;
  if (!q.kickoff) env.kickoffSrc = `default (${DEFAULT_KICKOFF})`;
  return env;
}
