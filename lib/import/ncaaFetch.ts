// Server-side fetcher for the public ncaa.com game-center GraphQL (sdataprod.ncaa.com).
// Plain fetch, honest UA, in-memory cache so N viewers make at most one upstream call per TTL,
// and a cool-down after any 4xx/429/5xx. No evasion of bot protection of any kind.
// Persisted-query hashes are what ncaa.com's own site uses; they can rotate, so each is env-overridable.
import type { NcaaBoxResponse, NcaaContestsResponse, NcaaPbpResponse } from './ncaaCom';

const BASE = 'https://sdataprod.ncaa.com/';
const UA = 'GatorSubBoard/1.0';

export const NCAA_QUERIES = {
  contests: { op: 'GetContests_web', env: 'NCAA_CONTESTS_HASH', hash: '4bcb5e6432fa9da365c0c19af01b1f9015cc7eb5c21e7af2dba308784a166df7' },
  pbp: { op: 'NCAA_GetGamecenterPbpGenericById_web', env: 'NCAA_PBP_HASH', hash: '57f922d56d60d88326b62202b3d88e8cd3cfb6687931bc0b5b3dfab089b84faa' },
  box: { op: 'NCAA_GetGamecenterBoxscoreSoccerById_web', env: 'NCAA_BOX_HASH', hash: 'c9070c4e5a76468a4025896df89f8a7b22be8275c54a22ff79619cbb27d63d7d' },
} as const;
type QueryName = keyof typeof NCAA_QUERIES;

export class NcaaUpstreamError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function ncaaUrl(q: QueryName, variables: Record<string, unknown>): string {
  const def = NCAA_QUERIES[q];
  const hash = process.env[def.env] || def.hash;
  const ext = encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: hash } }));
  const vars = encodeURIComponent(JSON.stringify(variables));
  return `${BASE}?meta=${def.op}&extensions=${ext}&variables=${vars}`;
}

type Entry = { at: number; ttl: number; value?: unknown; promise?: Promise<unknown>; errorUntil?: number; error?: NcaaUpstreamError };
const cache = new Map<string, Entry>();
const MAX_ENTRIES = 200;
const COOL_DOWN_MS = 5 * 60_000;

async function cachedGet<T>(url: string, ttlMs: number): Promise<T> {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit?.errorUntil && hit.errorUntil > now && hit.error) throw hit.error;
  if (hit?.value !== undefined && now - hit.at < hit.ttl) return hit.value as T;
  if (hit?.promise) return hit.promise as Promise<T>;
  const promise = (async () => {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) {
      const err = new NcaaUpstreamError(`ncaa.com responded ${res.status}`, res.status);
      cache.set(url, { at: Date.now(), ttl: 0, errorUntil: Date.now() + COOL_DOWN_MS, error: err });
      throw err;
    }
    const json = (await res.json()) as T & { errors?: { message?: string }[] };
    if (json.errors?.length) {
      const err = new NcaaUpstreamError(`ncaa.com query error: ${json.errors[0]?.message || 'unknown'} (persisted-query hash may have rotated)`, 502);
      cache.set(url, { at: Date.now(), ttl: 0, errorUntil: Date.now() + COOL_DOWN_MS, error: err });
      throw err;
    }
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(url, { at: Date.now(), ttl: ttlMs, value: json });
    return json;
  })();
  cache.set(url, { ...(hit || { at: 0, ttl: 0 }), promise });
  try {
    return (await promise) as T;
  } finally {
    const e = cache.get(url);
    if (e?.promise === promise) delete e.promise;
  }
}

/** date: YYYY-MM-DD. Women's soccer season year = calendar year (fall sport). */
export function fetchContests(date: string): Promise<NcaaContestsResponse> {
  const [y, m, d] = date.split('-');
  return cachedGet(ncaaUrl('contests', { sportCode: 'WSO', division: 1, seasonYear: Number(y), contestDate: `${m}/${d}/${y}` }), 60_000);
}

/** Live games: 45s TTL; finished games: 10 min. */
export async function fetchGame(contestId: string, live = true): Promise<{ pbp: NcaaPbpResponse; box: NcaaBoxResponse }> {
  const ttl = live ? 45_000 : 600_000;
  const vars = { contestId, staticTestEnv: null };
  const [pbp, box] = await Promise.all([cachedGet<NcaaPbpResponse>(ncaaUrl('pbp', vars), ttl), cachedGet<NcaaBoxResponse>(ncaaUrl('box', vars), ttl)]);
  return { pbp, box };
}
