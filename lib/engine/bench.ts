// Bench minutes. Port of gator-sub-board.html L1591.
import type { Game } from '@/lib/types';
import { sum } from './util';
import { fullD } from './core';

export interface BenchResult {
  uf: { S: number; B: number; N: number; list: { name: string; min: number }[] };
  op: { S: number; B: number; N: number } | null;
}
export interface BenchGame { g: Game; b: BenchResult }

function benchOne(g: Game): BenchResult {
  const F = fullD(g);
  const bx = (p: { name: string; min?: number }) => (p.min != null ? +p.min : Math.round(F.mins[p.name] || 0));
  const ufSt = g.lineup.starters.map((p) => ({ name: p.name, min: bx(p) }));
  const ufBe = g.lineup.bench.map((p) => ({ name: p.name, min: bx(p) })).filter((p) => p.min > 0);
  const ol = g.oppLineup && g.oppLineup.starters && g.oppLineup.starters.length && typeof g.oppLineup.starters[0] === 'object' ? g.oppLineup : null;
  const op = ol ? { S: sum(ol.starters.map((p) => +(p.min ?? 0) || 0)), B: sum(ol.bench.map((p) => +(p.min ?? 0) || 0)), N: ol.bench.filter((p) => (+(p.min ?? 0) || 0) > 0).length } : null;
  return { uf: { S: sum(ufSt.map((p) => p.min)), B: sum(ufBe.map((p) => p.min)), N: ufBe.length, list: ufBe }, op };
}

/** Starter vs bench minutes (box-score minutes when present, else engine minutes). One game → result; list → per-game results. */
export function benchOf(g: Game): BenchResult;
export function benchOf(games: Game[]): BenchGame[];
export function benchOf(x: Game | Game[]): BenchResult | BenchGame[] {
  return Array.isArray(x) ? x.map((g) => ({ g, b: benchOne(g) })) : benchOne(x);
}
