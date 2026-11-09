// Thin wrappers around the engine's environment functions (lib/engine/env.ts, scenario.ts).
// Keeps the UI's argument convention in one place and normalises empty results so the tab never crashes.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { chkRun, envPlayersAB, envRankRowsOf, envTeamOf, scnCompute, type EnvPlayer } from '@/lib/engine';
import type { Game } from '@/lib/types';
import type { FactorKey } from './envUtil';

type Agg = Record<string, any>;
const arr = <T = Agg>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Original envPlayers(A,B) (L1694): per-player usage on each side of the split. */
export function players(_all: Game[], _fk: FactorKey, A: Game[], B: Game[], _eheat: number): Agg[] {
  void _all; void _fk; void _eheat;
  return envPlayersAB(A, B).filter((r) => r && r.A && r.B) as unknown as Agg[];
}
/** Original envTeam(games) (L1709) for one side. */
export function team(side: Game[], _fk: FactorKey, eheat: number): Agg {
  void _fk;
  return (envTeamOf(side, { eheat }) ?? {}) as Agg;
}
/** Original envRankRows(P) (L1757). */
export function rank(all: Game[], P: Agg[], _fk: FactorKey, eheat: number): Agg[] {
  void _fk;
  return envRankRowsOf(P as unknown as EnvPlayer[], all, { eheat, allGames: all }) as unknown as Agg[];
}
/** Original scnCompute (L2289): sel = [[factor, value], …]. */
export function scenario(games: Game[], sel: [FactorKey, string][], eheat: number): Agg {
  const r = scnCompute(games, Object.fromEntries(sel), { eheat });
  return { ...r, rows: arr(r.rows), direct: arr(r.direct), excluded: r.excluded ?? 0 };
}
/** Original chkRun(g) (L2214): pool group/result filter + factors included + data window. */
export function check(all: Game[], g: Game, o: { inc: Record<FactorKey, boolean>; data: 'prior' | 'all'; eheat: number; egrp: string; eres: string }): Agg {
  const r = chkRun(all, { gameId: g.id, inc: o.inc, data: o.data, eheat: o.eheat, egrp: o.egrp, eres: o.eres });
  if (!r) return { rows: [], sel: [], pool: [], v: {}, hits: 0, miss: 0, flat: 0, topD: null, botD: null, nTop: 0 };
  return { ...r, rows: arr(r.rows), sel: arr(r.sel), pool: arr(r.pool) };
}
