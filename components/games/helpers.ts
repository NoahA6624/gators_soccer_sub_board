// Local helpers for the Games + Player Profile tabs (owned by agent G).
// Ported from gator-sub-board.html L598, L1111–1125, L2020–2041.
import { clk, fullD, halfD, isSEC, posOf, sum, type Agg } from '@/lib/engine';
import type { Game, Roster } from '@/lib/types';

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export const r1 = (v: number) => Math.round(v * 10) / 10;
export const isPost = (g: Game) => g.stage === 'Postseason';
/** "vs Opp" / "at Opp" (L2034) */
export const ppG = (g: Game) => `${g.venue === 'Home' ? 'vs' : 'at'} ${g.opp}`;
/** "MM/DD" (L2035) */
export const ppD = (g: Game) => g.date.slice(5).replace('-', '/');

export type GrpFn = ((g: Game) => boolean) | null;
/** Match groups for the profile tab (L2021). */
export const PPGRP: [string, string, GrpFn][] = [
  ['all', 'Entire season', () => true],
  ['nc', 'Non-conference', (g) => !isSEC(g) && !isPost(g)],
  ['sec', 'SEC (regular season)', (g) => isSEC(g) && !isPost(g)],
  ['post', 'Postseason', isPost],
  ['p4', 'Power 4', (g) => g.tier === 'P4'],
  ['np4', 'Non-Power 4', (g) => g.tier !== 'P4'],
  ['home', 'Home', (g) => g.venue === 'Home'],
  ['away', 'Away', (g) => g.venue === 'Away'],
  ['last3', 'Last 3 matches', null],
  ['last5', 'Last 5 matches', null],
];
export const grpFn = (k: string): ((g: Game) => boolean) => PPGRP.find((x) => x[0] === k)?.[2] ?? (() => true);
export const PPBINS: [number, number][] = [[0, 15], [15, 30], [30, 45], [45, 60], [60, 75], [75, 90]];

/** Games in the profile selection (L2023). */
export function ppGames(games: Game[], grp: string, res: string): Game[] {
  let gs: Game[];
  if (grp.startsWith('g:')) gs = games.filter((g) => g.id === grp.slice(2));
  else if (grp === 'last3' || grp === 'last5') gs = games.slice(-(grp === 'last3' ? 3 : 5));
  else gs = games.filter(grpFn(grp));
  return gs.filter((g) => res === 'All' || g.result === res);
}

/** Monday-start week key (L2038). */
export const wkKey = (d: string) => {
  const t = new Date(d + 'T12:00:00Z');
  const dow = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dow);
  return t.toISOString().slice(0, 10);
};
/** game id -> {n matches that week, i = index in week} (L2039). */
export function wkInfo(games: Game[]): Record<string, { n: number; i: number }> {
  const by: Record<string, Game[]> = {};
  games.forEach((g) => (by[wkKey(g.date)] ||= []).push(g));
  const info: Record<string, { n: number; i: number }> = {};
  Object.values(by).forEach((list) => {
    list.sort((a, b) => a.date.localeCompare(b.date));
    list.forEach((g, i) => (info[g.id] = { n: list.length, i: i + 1 }));
  });
  return info;
}

/* ---------------------------------------------------------- minutes table (L1112–1125) */
export interface MinRow {
  p: string; first: string; num: string; pos: string; role: 'Start' | 'Sub';
  m1: number; m2: number; full: number; x1: number; x2: number; xf: number;
  spells: string; firstOn: number;
}
export type MinKey = 'order' | 'num' | 'p' | 'pos' | 'role' | 'm1' | 'm2' | 'full' | 'spells';
export const MCOLS: [Exclude<MinKey, 'order'>, string, 1 | -1][] = [
  ['num', '#', 1], ['p', 'Player', 1], ['pos', 'Pos', 1], ['role', 'Role', 1],
  ['m1', '1st half', -1], ['m2', '2nd half', -1], ['full', 'Full match', -1], ['spells', 'On the field', 1],
];

/** Local port of minutesRows (L1112). Engine's minutesRows() has a different shape; this one is UI-only. */
export function minutesRowsLocal(g: Game, games: Game[], roster: Roster) {
  const F = fullD(g), h1 = halfD(g, 1), h2 = halfD(g, 2);
  const st = (g.lineup?.starters ?? []).map((p) => p.name);
  const info: Record<string, { first?: string; num?: string }> = {};
  [...(g.lineup?.starters ?? []), ...(g.lineup?.bench ?? [])].forEach((p) => (info[p.name] = p));
  const spells = F?.spells ?? {};
  const played = Object.keys(spells).filter((p) => spells[p]?.length);
  const order = [
    ...st.filter((p) => played.includes(p)),
    ...played.filter((p) => !st.includes(p)).sort((a, b) => spells[a][0][0] - spells[b][0][0]),
  ];
  const rows: MinRow[] = order.map((p) => {
    const x1 = h1?.minH?.[p] || 0, x2 = h2?.minH?.[p] || 0, xf = F?.mins?.[p] || 0;
    return {
      p, first: info[p]?.first || '', num: info[p]?.num || '', pos: posOf(p, games, roster), role: st.includes(p) ? 'Start' : 'Sub',
      m1: r1(x1), m2: r1(x2), full: r1(xf), x1, x2, xf,
      spells: spells[p].map(([a, b]) => `${clk(a)}–${clk(b)}`).join(', '), firstOn: spells[p][0][0],
    };
  });
  const unused = (g.lineup?.bench ?? []).map((p) => p.name).filter((p) => !played.includes(p));
  return { rows, unused, END: F?.END ?? 90 };
}

export function sortRows(rows: MinRow[], key: MinKey, dir: number): MinRow[] {
  if (key === 'order') return rows;
  const v = (r: MinRow): string | number => (key === 'spells' ? r.firstOn ?? 0 : key === 'num' ? +r.num || 0 : r[key]);
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const x = v(a.r), y = v(b.r);
      const c = typeof x === 'string' ? x.localeCompare(String(y)) : x - (y as number);
      return dir * c || a.i - b.i;
    })
    .map((o) => o.r);
}

export const totalOf = (rows: MinRow[], k: 'x1' | 'x2' | 'xf') => r1(sum(rows.map((r) => r[k])));

/** Spell list text "0:00–45:00, 60:00–90:00". */
export const spellText = (sp: unknown) =>
  Array.isArray(sp) ? sp.map(([a, b]: [number, number]) => `${clk(a)}–${clk(b)}`).join(', ') : '';

export const recG = (r: Agg | null | undefined): Game | undefined => r?.g as Game | undefined;
