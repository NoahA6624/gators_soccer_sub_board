// Engine public API. OWNED BY AGENT A (engine). Other agents import from '@/lib/engine' only.
// Port of gator-sub-board.html L620–782 and tab engines. Function names match the original.
// Until agent A lands, these are stubs returning empty-but-valid shapes so UI can compile.
import type { Filters, Game, LoadsByGame, Roster, Scope } from '@/lib/types';

export * from './util';
export * from './names';

/** Spell interval in match minutes [start, end). */
export type Spell = [number, number];

export interface SubRec {
  t: number; // seconds
  min: number; // minutes
  half: number;
  clock: string;
  on: string;
  off: string;
  uf: number;
  opp: number;
  state: 'Winning' | 'Level' | 'Losing';
}

export interface FullDerived {
  END: number;
  restarts: number[];
  spells: Record<string, Spell[]>;
  mins: Record<string, number>;
  subs: SubRec[];
  reds: { player: string; min: number }[];
  htSubs: SubRec[];
  inplay2: SubRec[];
  scoreAt: (tSec: number) => { uf: number; opp: number };
  ufShots: number[];
  ufGoals: number[];
  oppShots: number[];
  oppGoals: number[];
  oppSubs: number[];
}

export interface HalfDerived {
  h: 1 | 2;
  lo: number;
  hi: number;
  starters: string[];
  subs: SubRec[];
  moments: { t: number; min: number; subs: SubRec[] }[];
  full: string[];
  minH: Record<string, number>;
  ufShots: number[];
  ufGoals: number[];
  oppShots: number[];
  oppGoals: number[];
  oppSubs: number[];
  first: number | null;
  last: number | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
export type Agg = Record<string, any>;

const stub = (name: string) => {
  if (process.env.NODE_ENV === 'test') throw new Error(`engine stub: ${name}`);
};

export function fullD(g: Game): FullDerived {
  stub('fullD');
  return { END: 90, restarts: [0, 45], spells: {}, mins: {}, subs: [], reds: [], htSubs: [], inplay2: [], scoreAt: () => ({ uf: 0, opp: 0 }), ufShots: [], ufGoals: [], oppShots: [], oppGoals: [], oppSubs: [] };
}
export function halfD(g: Game, h: 1 | 2): HalfDerived {
  stub('halfD');
  return { h, lo: h === 1 ? 0 : 45, hi: h === 1 ? 45 : 90, starters: [], subs: [], moments: [], full: [], minH: {}, ufShots: [], ufGoals: [], oppShots: [], oppGoals: [], oppSubs: [], first: null, last: null };
}
export const derive = (g: Game) => halfD(g, 1);

export function filtered(games: Game[], f: Filters): Game[] { stub('filtered'); return games; }
export function posOf(name: string, games: Game[], roster: Roster): string { stub('posOf'); return roster[name]?.pos ?? ''; }
export function isSEC(g: Game): boolean { stub('isSEC'); return g.conf === 'SEC'; }

export function teamStats(games: Game[], h: 1 | 2): Agg { stub('teamStats'); return {}; }
export function playerStats(games: Game[], h: 1 | 2, loads?: LoadsByGame): Agg[] { stub('playerStats'); return []; }
export function fullPlayerStats(games: Game[], loads?: LoadsByGame): Agg[] { stub('fullPlayerStats'); return []; }
export function fullTeamStats(games: Game[]): Agg { stub('fullTeamStats'); return {}; }
export function roleOf(p: Agg): string { stub('roleOf'); return 'spot'; }
export function patternText(p: Agg): string { stub('patternText'); return ''; }
export function insights(games: Game[], h: 1 | 2): string[] { stub('insights'); return []; }
export function fullInsights(games: Game[]): string[] { stub('fullInsights'); return []; }

// Bench (L1591)
export function benchOf(games: Game[]): Agg { stub('benchOf'); return {}; }
// Environment (L1671–1757)
export function envOf(g: Game): Agg { stub('envOf'); return {}; }
export function envPlayers(games: Game[], factor: string, opts?: Agg): Agg[] { stub('envPlayers'); return []; }
export function envTeam(games: Game[], factor: string, opts?: Agg): Agg { stub('envTeam'); return {}; }
export function envRankRows(games: Game[], opts?: Agg): Agg[] { stub('envRankRows'); return []; }
// Strategy (L1907–1930)
export function stGames(games: Game[], opts: Agg): Game[] { stub('stGames'); return games; }
export function stStats(games: Game[], opts?: Agg): Agg { stub('stStats'); return {}; }
// Player profile (L2027–2041)
export function ppRec(games: Game[], player: string): Agg[] { stub('ppRec'); return []; }
export function ppAgg(recs: Agg[]): Agg { stub('ppAgg'); return {}; }
export function ppWeek(games: Game[], player: string): Agg { stub('ppWeek'); return {}; }
// Rests (L2161–2164)
export function restsOf(games: Game[], player?: string): Agg[] { stub('restsOf'); return []; }
export function restAgg(rests: Agg[]): Agg { stub('restAgg'); return {}; }
// Scenario / impact check (L2204–2299)
export function scnCompute(games: Game[], sel: Agg): Agg { stub('scnCompute'); return {}; }
export function chkRun(games: Game[], opts: Agg): Agg { stub('chkRun'); return {}; }
// Games tab minutes (L1112–1125)
export function minutesRows(g: Game): Agg[] { stub('minutesRows'); return []; }

export type { Scope };
