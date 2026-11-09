// Bench tab derivations (agent H). Port of BPRESETS / benchOf (L1590–1597) plus a
// starters-vs-bench output comparison (shots, goals, GPS per minute).
// benchOf is ported locally per game: the engine stub exposes benchOf(games[]) while the
// original is per-match, so this keeps the tab independent of that shape.
import { sum } from '@/lib/engine';
import type { Game, LoadsByGame } from '@/lib/types';
import { safeFull, secOf } from './common';

export type BKey = 'all' | 'p4' | 'ncp4' | 'sec' | 'nc' | 'np4' | 'last5' | 'last3';
export const BPRESETS: [BKey, string, (g: Game, all: Game[]) => boolean][] = [
  ['all', 'All games', () => true],
  ['p4', 'Power 4', (g) => g.tier === 'P4'],
  ['ncp4', 'Non-conf Power 4', (g) => g.tier === 'P4' && !secOf(g)],
  ['sec', 'SEC', (g) => secOf(g)],
  ['nc', 'Non-conference', (g) => !secOf(g)],
  ['np4', 'Non-P4', (g) => g.tier !== 'P4'],
  ['last5', 'Last 5', (g, all) => all.slice(-5).includes(g)],
  ['last3', 'Last 3', (g, all) => all.slice(-3).includes(g)],
];

export interface BenchSide { S: number; B: number; N: number }
export interface BenchGame {
  uf: BenchSide & { list: { name: string; min: number }[] };
  op: BenchSide | null;
}

export function benchOfGame(g: Game): BenchGame {
  const F = safeFull(g);
  const bx = (p: { name: string; min?: number }) => (p.min != null ? +p.min : Math.round(F?.mins?.[p.name] || 0));
  const st = g.lineup?.starters ?? [], be = g.lineup?.bench ?? [];
  const ufSt = st.map((p) => ({ name: p.name, min: bx(p) }));
  const ufBe = be.map((p) => ({ name: p.name, min: bx(p) })).filter((p) => p.min > 0);
  const ol = g.oppLineup?.starters?.length && typeof g.oppLineup.starters[0] === 'object' ? g.oppLineup : null;
  const op = ol
    ? {
        S: sum(ol.starters.map((p) => +(p.min ?? 0) || 0)),
        B: sum((ol.bench ?? []).map((p) => +(p.min ?? 0) || 0)),
        N: (ol.bench ?? []).filter((p) => (+(p.min ?? 0) || 0) > 0).length,
      }
    : null;
  return { uf: { S: sum(ufSt.map((p) => p.min)), B: sum(ufBe.map((p) => p.min)), N: ufBe.length, list: ufBe }, op };
}

export interface OutputSide {
  apps: number; min: number; sh: number; g: number;
  gpsMin: number; dist: number; hsr: number; sprint: number; acc: number; gpsApps: number;
}
const emptySide = (): OutputSide => ({ apps: 0, min: 0, sh: 0, g: 0, gpsMin: 0, dist: 0, hsr: 0, sprint: 0, acc: 0, gpsApps: 0 });

/** Starters vs bench output: box-score shots/goals (falls back to play-by-play) and GPS loads per minute. */
export function benchOutput(games: Game[], loads: LoadsByGame) {
  const S = emptySide(), B = emptySide();
  for (const g of games) {
    const F = safeFull(g);
    const ev = (g.events ?? []).filter((e) => e.team === 'UF' && e.player);
    const shotsEv = (n: string) => ev.filter((e) => e.player === n && (e.type === 'SHOT' || e.type === 'GOAL')).length;
    const goalsEv = (n: string) => ev.filter((e) => e.player === n && e.type === 'GOAL').length;
    const rows = loads?.[g.id]?.rows ?? [];
    const add = (side: OutputSide, p: { name: string; min?: number; sh?: number; g?: number }) => {
      const min = p.min != null ? +p.min : Math.round(F?.mins?.[p.name] || 0);
      if (!(min > 0)) return;
      side.apps++; side.min += min;
      side.sh += p.sh != null ? +p.sh : shotsEv(p.name);
      side.g += p.g != null ? +p.g : goalsEv(p.name);
      const lr = rows.filter((r) => r.player === p.name);
      if (lr.length) {
        side.gpsApps++; side.gpsMin += min;
        side.dist += sum(lr.map((r) => +(r.dist ?? 0) || 0));
        side.hsr += sum(lr.map((r) => +(r.hsr ?? 0) || 0));
        side.sprint += sum(lr.map((r) => +(r.sprint ?? 0) || 0));
        side.acc += sum(lr.map((r) => +(r.acc ?? 0) || 0));
      }
    };
    (g.lineup?.starters ?? []).forEach((p) => add(S, p));
    (g.lineup?.bench ?? []).forEach((p) => add(B, p));
  }
  return { S, B };
}
