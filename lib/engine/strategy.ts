// Subbing strategy sheet. Port of gator-sub-board.html L1906–1930.
import type { Game } from '@/lib/types';
import { avg, sum } from './util';
import { fullD, isSEC, posWith, type EngineOpts } from './core';
import { envOf } from './env';

export const STGRP: [string, string, (g: Game) => boolean][] = [
  ['all', 'All games', () => true], ['p4', 'Power 4', (g) => g.tier === 'P4'], ['ncp4', 'Non-conf Power 4', (g) => g.tier === 'P4' && !isSEC(g)],
  ['sec', 'SEC', (g) => isSEC(g)], ['nc', 'Non-conference', (g) => !isSEC(g)], ['np4', 'Non-Power 4', (g) => g.tier !== 'P4'],
];

/** Strategy filters (S.st in the original). grp: STGRP key, 'last3'|'last5', or 'g:<gameId>'. */
export interface StOpts extends EngineOpts {
  grp?: string; role?: 'All' | 'Start' | 'Bench' | string; res?: string; ven?: string; ko?: 'All' | 'Night' | 'Early' | string; heat?: 'All' | 'Hot' | 'Cool' | string;
}

/** `games` = the full season (S.games). */
export function stGames(games: Game[], opts: StOpts = {}): Game[] {
  const grp = opts.grp ?? 'all', res = opts.res ?? 'All', ven = opts.ven ?? 'All', ko = opts.ko ?? 'All', heat = opts.heat ?? 'All', eheat = opts.eheat ?? 85;
  if (grp.startsWith('g:')) return games.filter((g) => g.id === grp.slice(2));
  if (grp === 'last3' || grp === 'last5') return games.slice(grp === 'last3' ? -3 : -5);
  const gf = (STGRP.find((x) => x[0] === grp) || STGRP[0])[2];
  return games.filter((g) => {
    const e = envOf(g);
    return gf(g) && (res === 'All' || g.result === res) && (ven === 'All' || g.venue === ven)
      && (ko === 'All' || (e.night != null && (ko === 'Night') === e.night))
      && (heat === 'All' || (e.heat != null && (heat === 'Hot') === e.heat >= eheat));
  });
}

export interface StRow { p: string; first: string; pos: string; gp: number; gs: number; on1: number | null; off1: number | null; m1: number; on2: number | null; off2: number | null; m2: number; len2: number | null; n2: number; tot: number; h1n: number; h2n: number }
export function stStats(games: Game[], opts: StOpts = {}): StRow[] {
  const role = opts.role ?? 'All';
  const pos = posWith(opts, games);
  type Acc = { p: string; first: string; gp: number; gs: number; on1: number[]; off1: number[]; on2: number[]; off2: number[]; m1: number; m2: number; tot: number; n2: number; len2: number[] };
  const P: Record<string, Acc> = {};
  games.forEach((g) => {
    const F = fullD(g);
    const st = new Set(g.lineup.starters.map((p) => p.name));
    const info: Record<string, { first?: string }> = {};
    [...g.lineup.starters, ...g.lineup.bench].forEach((p) => (info[p.name] = p));
    Object.entries(F.spells).forEach(([p, sp]) => {
      if (role === 'Start' && !st.has(p)) return;
      if (role === 'Bench' && st.has(p)) return;
      const r = P[p] || (P[p] = { p, first: '', gp: 0, gs: 0, on1: [], off1: [], on2: [], off2: [], m1: 0, m2: 0, tot: 0, n2: 0, len2: [] });
      if (info[p]?.first) r.first = info[p].first!;
      r.gp++; if (st.has(p)) r.gs++; r.tot += F.mins[p];
      const c1 = sp.map(([a, b]) => [Math.max(a, 0), Math.min(b, 45)]).filter(([a, b]) => b - a > 0.01);
      if (c1.length) { r.on1.push(c1[0][0]); r.off1.push(c1[c1.length - 1][1]); r.m1 += sum(c1.map(([a, b]) => b - a)); }
      const c2 = sp.map(([a, b]) => [Math.max(a, 45), Math.min(b, F.END)]).filter(([a, b]) => b - a > 0.01);
      if (c2.length) { r.on2.push(c2[0][0]); r.off2.push(c2[0][1] >= F.END - 0.01 ? 90 : Math.min(c2[0][1], 90)); r.m2 += sum(c2.map(([a, b]) => b - a)); r.n2 += c2.length; c2.forEach(([a, b]) => r.len2.push(b - a)); }
    });
  });
  return Object.values(P).map((r) => ({
    p: r.p, first: r.first, pos: pos(r.p), gp: r.gp, gs: r.gs, on1: avg(r.on1), off1: avg(r.off1), m1: r.m1 / r.gp, on2: avg(r.on2), off2: avg(r.off2), m2: r.m2 / r.gp,
    len2: avg(r.len2), n2: r.n2 / r.gp, tot: r.tot / r.gp, h1n: r.on1.length, h2n: r.on2.length,
  }));
}
