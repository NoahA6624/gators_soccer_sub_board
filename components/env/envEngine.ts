// Thin, defensive wrappers around the engine's environment functions. The engine (agent A) is
// landing concurrently with loosely-typed signatures; every call goes through here so the
// argument convention lives in one place and stub/partial results never crash the tab.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { chkRun, envPlayers, envRankRows, envTeam, scnCompute } from '@/lib/engine';
import type { Game } from '@/lib/types';
import type { FactorKey } from './envUtil';

type Agg = Record<string, any>;
const arr = (v: unknown): Agg[] => (Array.isArray(v) ? v : []);

/** Original envPlayers(A,B) (L1694). */
export function players(all: Game[], fk: FactorKey, A: Game[], B: Game[], eheat: number): Agg[] {
  return arr(envPlayers(all, fk, { A, B, eheat })).filter((r) => r && r.A && r.B);
}
/** Original envTeam(games) (L1709) for one side. */
export function team(side: Game[], fk: FactorKey, eheat: number): Agg {
  return envTeam(side, fk, { eheat }) ?? {};
}
/** Original envRankRows(P) (L1757). */
export function rank(all: Game[], P: Agg[], fk: FactorKey, eheat: number): Agg[] {
  return arr(envRankRows(all, { players: P, factor: fk, eheat }));
}
/** Original scnCompute (L2289): sel = [[factor, value], …]. */
export function scenario(games: Game[], sel: [FactorKey, string][], eheat: number): Agg {
  const r = scnCompute(games, { sel, eheat }) ?? {};
  return { ...r, rows: arr(r.rows), direct: arr(r.direct), excluded: r.excluded ?? 0 };
}
/** Original chkRun(g) (L2214): pool filter + factors included + data window. */
export function check(all: Game[], g: Game, o: { inc: Record<FactorKey, boolean>; data: 'prior' | 'all'; eheat: number; filter: (x: Game) => boolean }): Agg {
  const r = chkRun(all, { g, id: g.id, ...o }) ?? {};
  return { ...r, rows: arr(r.rows), sel: Array.isArray(r.sel) ? r.sel : [], pool: arr(r.pool), v: r.v ?? {}, hits: r.hits ?? 0, miss: r.miss ?? 0, flat: r.flat ?? 0 };
}
