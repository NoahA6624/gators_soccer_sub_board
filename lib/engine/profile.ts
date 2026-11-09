// Player profile + rests. Port of gator-sub-board.html L2027–2049, L2161–2164.
import type { Game } from '@/lib/types';
import { avg, sum } from './util';
import { fullD, type Spell } from './core';

export const PPBINS: [number, number][] = [[0, 15], [15, 30], [30, 45], [45, 60], [60, 75], [75, 90]];

export interface PPRec {
  g: Game; played: boolean; listed: boolean; min: number;
  start?: boolean; h1?: number; h2?: number; sp?: Spell[]; END?: number; bins?: number[];
}

function ppRecOne(g: Game, p: string): PPRec {
  const F = fullD(g);
  const sp = F.spells[p];
  const listed = [...g.lineup.starters, ...g.lineup.bench].some((x) => x.name === p);
  if (!sp) return { g, played: false, listed, min: 0 };
  const clip = (a: number, b: number) => sum(sp.map(([s, e]) => Math.max(0, Math.min(e, b) - Math.max(s, a))));
  return { g, played: true, listed, start: g.lineup.starters.some((x) => x.name === p), min: F.mins[p], h1: clip(0, 45), h2: clip(45, F.END), sp, END: F.END, bins: PPBINS.map(([a, b]) => clip(a, b)) };
}
/** Per-game record for a player. One game → record; list → records. */
export function ppRec(g: Game, player: string): PPRec;
export function ppRec(games: Game[], player: string): PPRec[];
export function ppRec(x: Game | Game[], player: string): PPRec | PPRec[] {
  return Array.isArray(x) ? x.map((g) => ppRecOne(g, player)) : ppRecOne(x, player);
}

export function ppAgg(recs: PPRec[]) {
  const P = recs.filter((r) => r.played);
  if (!P.length) return { apps: 0, starts: 0, n: recs.length } as { apps: number; starts: number; n: number } & Partial<ReturnType<typeof full>>;
  return full(recs, P);
}
function full(recs: PPRec[], P: PPRec[]) {
  const mx = P.reduce((a, b) => (b.min > a.min ? b : a));
  const mn = P.reduce((a, b) => (b.min < a.min ? b : a));
  return {
    n: recs.length, apps: P.length, starts: P.filter((r) => r.start).length, tot: sum(P.map((r) => r.min)), avg: avg(P.map((r) => r.min)),
    h1: avg(P.map((r) => r.h1!)), h2: avg(P.map((r) => r.h2!)), max: mx, min: mn,
    full: P.filter((r) => r.sp!.length === 1 && r.sp![0][0] === 0 && r.sp![0][1] >= r.END!).length, spells: avg(P.map((r) => r.sp!.length)),
    bins: PPBINS.map((_, i) => sum(P.map((r) => r.bins![i])) / (15 * P.length)), binOn: PPBINS.map((_, i) => P.filter((r) => r.bins![i] > 0.01).length),
  };
}

/** Monday of the game's week (YYYY-MM-DD). */
export const wkKey = (d: string) => {
  const t = new Date(d + 'T12:00:00Z');
  const dow = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dow);
  return t.toISOString().slice(0, 10);
};
const WK = new WeakMap<Game[], Record<string, { n: number; i: number }>>();
/** Per game id: matches in that Mon–Sun week (n) and this game's order in it (i). Pass the full season. */
export function wkInfo(allGames: Game[]): Record<string, { n: number; i: number }> {
  const c = WK.get(allGames);
  if (c) return c;
  const by: Record<string, Game[]> = {};
  allGames.forEach((g) => (by[wkKey(g.date)] = by[wkKey(g.date)] || []).push(g));
  const info: Record<string, { n: number; i: number }> = {};
  Object.values(by).forEach((list) => { list.sort((a, b) => a.date.localeCompare(b.date)); list.forEach((g, i) => (info[g.id] = { n: list.length, i: i + 1 })); });
  WK.set(allGames, info);
  return info;
}

/** One- vs two-match-week minutes for a player. `allGames` (full season) defines weeks; defaults to `games`. */
export function ppWeek(games: Game[], player: string, allGames: Game[] = games) {
  const recs = ppRec(games, player);
  const W = wkInfo(allGames);
  const w = (r: PPRec) => W[r.g.id] || { n: 1, i: 1 };
  const av = (l: PPRec[]) => {
    const P = l.filter((r) => r.played);
    if (!P.length) return { n: l.length, apps: 0, starts: 0, avg: null as number | null };
    const mx = P.reduce((a, b) => (b.min > a.min ? b : a)), mn = P.reduce((a, b) => (b.min < a.min ? b : a));
    return { n: l.length, apps: P.length, starts: P.filter((r) => r.start).length, avg: avg(P.map((r) => r.min)), max: mx, min: mn, maxN: P.filter((r) => Math.round(r.min) === Math.round(mx.min)).length, minN: P.filter((r) => Math.round(r.min) === Math.round(mn.min)).length };
  };
  const one = recs.filter((r) => w(r).n === 1), two = recs.filter((r) => w(r).n >= 2);
  const byWk: Record<string, PPRec[]> = {};
  two.forEach((r) => (byWk[wkKey(r.g.date)] = byWk[wkKey(r.g.date)] || []).push(r));
  const pairs = Object.keys(byWk).sort().map((k) => byWk[k].sort((a, b) => a.g.date.localeCompare(b.g.date)))
    .filter((l) => l.length >= 2 && (l[0].played || l[1].played)).map((l) => ({ m1: l[0], m2: l[1], d: (l[1].min || 0) - (l[0].min || 0) }));
  return { one: av(one), two: av(two), g1: av(two.filter((r) => w(r).i === 1)), g2: av(two.filter((r) => w(r).i >= 2)), pairs, home: av(recs.filter((r) => r.g.venue === 'Home')), away: av(recs.filter((r) => r.g.venue === 'Away')) };
}

// ---- Rests between spells (2nd half). A rest = off then back on, both in the 2nd half (off at HT counts, from 45:00).
export interface Rest { g: Game; off: number; on: number; len: number; back: number; kind: 'in2' | 'ht' }
export function restsOfSpells(sp: Spell[], g: Game): Rest[] {
  const out: Rest[] = [];
  for (let i = 0; i < sp.length - 1; i++) {
    const off = sp[i][1], on = sp[i + 1][0];
    if (on < 45 - 0.01) continue;
    if (off < 45 - 0.01) continue;
    out.push({ g, off, on, len: on - off, back: sp[i + 1][1] - on, kind: 'in2' });
  }
  return out;
}
/** All rests in these games (optionally for one player). */
export function restsOf(games: Game[], player?: string): (Rest & { p: string })[] {
  return games.flatMap((g) => Object.entries(fullD(g).spells).filter(([p]) => player == null || p === player).flatMap(([p, sp]) => restsOfSpells(sp, g).map((r) => ({ ...r, p }))));
}
/** Rests in one game (optionally for one player). */
export function restsOfGame(g: Game, player?: string): (Rest & { p: string })[] {
  return restsOf([g], player);
}
export function restAgg(list: Rest[]) {
  if (!list.length) return { n: 0 } as { n: number; avg?: number | null; max?: Rest; min?: Rest; back?: number | null; matches?: number };
  const mx = list.reduce((a, b) => (b.len > a.len ? b : a)), mn = list.reduce((a, b) => (b.len < a.len ? b : a));
  return { n: list.length, avg: avg(list.map((r) => r.len)), max: mx, min: mn, back: avg(list.map((r) => r.back)), matches: new Set(list.map((r) => r.g.id)).size };
}
