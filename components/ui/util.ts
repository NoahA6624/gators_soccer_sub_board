// Defensive formatting + list helpers shared by tab UIs.
// The engine is being built concurrently, so every aggregate field may be missing:
// these helpers turn undefined/NaN into '—' and objects-or-arrays into arrays.
//
//   isNum(v)            -> v is a finite number
//   fx(v, d=1)          -> v.toFixed(d) or '—'
//   rnd(v)              -> Math.round(v) as string or '—'
//   arr(v)              -> v if array else []
//   toList(x)           -> array of aggregates (accepts Agg[] or Record<string, Agg>)
//   byP(x)              -> Record<last name, Agg> keyed by r.p
//   safe(fn, fallback)  -> fn() but returns fallback on throw/nullish
//   subMin(s)           -> minute of a sub/point record (s.m ?? s.min)
//   esc(s)              -> HTML-escape
//   relabel(html, idx)  -> replace `<b>Last</b>` in engine HTML strings with `<b>#19 - Mary Jane</b>`
//   cmpPlayers(a,b,idx) -> sort by shirt number, then display name
import { playerLabel, type Agg, type NameIndex } from '@/lib/engine';

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const fx = (v: unknown, d = 1) => (isNum(v) ? v.toFixed(d) : '—');
export const rnd = (v: unknown) => (isNum(v) ? String(Math.round(v)) : '—');
export const arr = <T = Agg>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export const toList = (x: unknown): Agg[] =>
  Array.isArray(x) ? (x as Agg[]) : x && typeof x === 'object' ? (Object.values(x) as Agg[]) : [];

export const byP = (x: unknown): Record<string, Agg> =>
  Object.fromEntries(toList(x).filter((r) => r && r.p != null).map((r) => [r.p as string, r]));

export function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn() ?? fallback;
  } catch {
    return fallback;
  }
}

export const subMin = (s: Agg | null | undefined): number => {
  const v = s?.m ?? s?.min;
  return isNum(v) ? v : NaN;
};

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** Engine insight strings bold raw last names (`<b>Smith</b>`); swap them for display labels. */
export function relabel(html: string, idx: NameIndex): string {
  return String(html ?? '').replace(/<b>([^<]+)<\/b>/g, (all, inner: string) => {
    const key = inner.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'");
    return idx[key] ? `<b>${esc(playerLabel(key, idx))}</b>` : all;
  });
}

const numOf = (last: string, idx: NameIndex) => {
  const v = parseInt(String(idx[last]?.num ?? '').replace(/^#/, ''), 10);
  return Number.isNaN(v) ? Number.POSITIVE_INFINITY : v;
};

/** Name sort: shirt number ascending (players without a number last), then display name. */
export function cmpPlayers(a: string, b: string, idx: NameIndex): number {
  const na = numOf(a, idx), nb = numOf(b, idx);
  if (na !== nb) return na < nb ? -1 : 1;
  return playerLabel(a, idx).localeCompare(playerLabel(b, idx));
}
