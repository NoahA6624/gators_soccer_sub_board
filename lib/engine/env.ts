// Environment factors. Port of gator-sub-board.html L1671–1757.
import type { Game } from '@/lib/types';
import { avg } from './util';
import { firstOf, fullD, halfD, posWith, type EngineOpts } from './core';
import { wkInfo } from './profile';

export const numv = (v: unknown): number | null => (v === '' || v == null || isNaN(+(v as number)) ? null : +(v as number));
export const rhFrom = (T: number, D: number) => {
  const c = (f: number) => ((f - 32) * 5) / 9, t = c(T), d = c(D);
  return (100 * Math.exp((17.625 * d) / (243.04 + d))) / Math.exp((17.625 * t) / (243.04 + t));
};
/** NWS Rothfusz regression with adjustments, °F. */
export function heatIndex(T: number, RH: number) {
  let hi = 0.5 * (T + 61 + (T - 68) * 1.2 + RH * 0.094);
  if ((hi + T) / 2 < 80) return hi;
  hi = -42.379 + 2.04901523 * T + 10.14333127 * RH - 0.22475541 * T * RH - 0.00683783 * T * T - 0.05481717 * RH * RH + 0.00122874 * T * T * RH + 0.00085282 * T * RH * RH - 0.00000199 * T * T * RH * RH;
  if (RH < 13 && T >= 80 && T <= 112) hi -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  else if (RH > 85 && T >= 80 && T <= 87) hi += ((RH - 85) / 10) * ((87 - T) / 5);
  return hi;
}
export interface Env { kickoff: string; kmin: number | null; night: boolean | null; T: number | null; D: number | null; rh: number | null; hi: number | null; heat: number | null; basis: 'Heat index' | 'Temp' | null; uv: number | null; src: string }
export function envOf(g: Game): Env {
  const e = g.env || {};
  const T = numv(e.tempF), D = numv(e.dewF);
  const rh = T != null && D != null ? Math.min(100, rhFrom(T, D)) : null;
  const km = /^(\d{1,2}):(\d{2})$/.exec(e.kickoff || '');
  const kmin = km ? +km[1] * 60 + +km[2] : null;
  const hi = rh != null ? heatIndex(T!, rh) : null;
  return { kickoff: e.kickoff || '', kmin, night: kmin == null ? null : kmin > 17 * 60, T, D, rh, hi, heat: hi != null ? hi : T, basis: hi != null ? 'Heat index' : T != null ? 'Temp' : null, uv: numv(e.uv), src: e.src || '' };
}
export const k12 = (kmin: number | null) => {
  if (kmin == null) return '—';
  const h = Math.floor(kmin / 60), m = kmin % 60;
  return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`;
};

export type FactorKey = 'venue' | 'time' | 'heat' | 'week';
export interface EnvCtx { eheat: number; allGames: Game[] }
export const EFACT: Record<FactorKey, { label: string; A: string; B: string; grp: (g: Game, c: EnvCtx) => 'A' | 'B' | null; why: string }> = {
  venue: { label: 'Home vs Away', A: 'Home', B: 'Away', grp: (g) => (g.venue === 'Home' ? 'A' : g.venue === 'Away' ? 'B' : null), why: 'Travel, unfamiliar surfaces and crowd. Away = the stress condition.' },
  time: { label: 'Early vs Night', A: 'Night', B: 'Early', grp: (g) => { const e = envOf(g); return e.night == null ? null : e.night ? 'A' : 'B'; }, why: 'Night = kickoff after 5:00 PM local. Anything earlier is Early, the daytime heat-and-sun condition.' },
  heat: { label: 'Heat', A: 'Cooler', B: 'Hot', grp: (g, c) => { const e = envOf(g); return e.heat == null ? null : e.heat >= c.eheat ? 'B' : 'A'; }, why: 'Air temperature at kickoff. When a dew point is entered for a match, its heat index (NWS formula) is used instead.' },
  week: { label: '1 vs 2 match weeks', A: 'Single-match week', B: 'Two-match week', grp: (g, c) => { const w = wkInfo(c.allGames)[g.id]; return w ? (w.n >= 2 ? 'B' : 'A') : null; }, why: 'Weeks run Monday–Sunday. A two-match week has 2 matches in the same week (usually Thu + Sun); every other week is a single-match week. Two-match week = the congested condition.' },
};
const ctxOf = (games: Game[], o: EngineOpts): EnvCtx => ({ eheat: o.eheat ?? 85, allGames: o.allGames ?? games });
/** Split games into factor groups A / B (unclassified games dropped). */
export function envSplit(games: Game[], factor: string, opts: EngineOpts = {}) {
  const f = EFACT[factor as FactorKey];
  if (!f) throw new Error(`unknown env factor: ${factor}`);
  const c = ctxOf(games, opts);
  return { A: games.filter((g) => f.grp(g, c) === 'A'), B: games.filter((g) => f.grp(g, c) === 'B') };
}

interface Side { apps: number; starts: number; min: number; spells: number; lens: number[]; exits: number[]; games: string[]; mpa: number | null; spa: number | null; len: number | null; exit: number | null }
export interface EnvPlayer { p: string; A: Side; B: Side; ok: boolean; dMin: number | null; dLen: number | null; dSpa: number | null; dExit: number | null; abs: number; absLen: number; totB: number; appsT: number; mA: number; mB: number; lenB: number }
/** Original envPlayers(A,B). */
export function envPlayersAB(A: Game[], B: Game[]): EnvPlayer[] {
  const P: Record<string, EnvPlayer> = {};
  const blank = (): Side => ({ apps: 0, starts: 0, min: 0, spells: 0, lens: [], exits: [], games: [], mpa: null, spa: null, len: null, exit: null });
  const add = (g: Game, k: 'A' | 'B') => {
    const F = fullD(g);
    const st = new Set(g.lineup.starters.map((p) => p.name));
    Object.entries(F.spells).forEach(([p, sp]) => {
      const r = P[p] || (P[p] = { p, A: blank(), B: blank() } as EnvPlayer);
      const x = r[k];
      x.apps++; x.min += F.mins[p]; x.spells += sp.length; sp.forEach((s) => x.lens.push(s[1] - s[0]));
      if (st.has(p)) { x.starts++; if (sp[0][0] === 0 && sp[0][1] < F.END - 0.01) x.exits.push(sp[0][1]); }
      x.games.push(`${g.venue === 'Home' ? 'vs' : 'at'} ${g.opp}: ${Math.round(F.mins[p])}' in ${sp.length} spell${sp.length > 1 ? 's' : ''}`);
    });
  };
  A.forEach((g) => add(g, 'A')); B.forEach((g) => add(g, 'B'));
  Object.values(P).forEach((r) => {
    (['A', 'B'] as const).forEach((k) => { const x = r[k]; x.mpa = x.apps ? x.min / x.apps : null; x.spa = x.apps ? x.spells / x.apps : null; x.len = avg(x.lens); x.exit = x.exits.length ? avg(x.exits) : null; });
    const d = (a: number | null, b: number | null) => (a != null && b != null ? b - a : null);
    r.ok = r.A.apps >= 2 && r.B.apps >= 2; r.dMin = d(r.A.mpa, r.B.mpa); r.dLen = d(r.A.len, r.B.len); r.dSpa = d(r.A.spa, r.B.spa);
    r.dExit = r.A.exits.length && r.B.exits.length ? r.B.exit! - r.A.exit! : null; r.abs = Math.abs(r.dMin || 0); r.absLen = Math.abs(r.dLen || 0);
    r.totB = r.B.min; r.appsT = r.A.apps + r.B.apps; r.mA = r.A.mpa ?? -1; r.mB = r.B.mpa ?? -1; r.lenB = r.B.len ?? -1;
  });
  return Object.values(P);
}
export function envPlayers(games: Game[], factor: string, opts: EngineOpts = {}): EnvPlayer[] {
  const { A, B } = envSplit(games, factor, opts);
  return envPlayersAB(A, B);
}

/** Original envTeam(games) for one group. */
export function envTeamOf(games: Game[], opts: EngineOpts = {}) {
  const n = games.length;
  if (!n) return null;
  const Fs = games.map(fullD);
  const pos = posWith(opts, games);
  const nonGK = (p: string) => pos(p) !== 'GK';
  return {
    n, W: games.filter((g) => g.result === 'W').length, T: games.filter((g) => g.result === 'T').length, L: games.filter((g) => g.result === 'L').length,
    ip: avg(Fs.map((F) => F.inplay2.length + F.subs.filter((s) => s.half === 1 && !s.brk).length)),
    first: avg(games.map((g) => halfD(g, 1).first).filter((x): x is number => x != null)),
    used: avg(Fs.map((F) => Object.keys(F.spells).length)),
    f90: avg(Fs.map((F) => Object.entries(F.spells).filter(([p, sp]) => nonGK(p) && sp.length === 1 && sp[0][0] === 0 && sp[0][1] >= F.END).length)),
    len: avg(Fs.flatMap((F) => Object.entries(F.spells).filter(([p]) => nonGK(p)).flatMap(([, sp]) => sp.map((s) => s[1] - s[0])))),
    stMin: avg(games.flatMap((g, i) => g.lineup.starters.filter((p) => nonGK(p.name)).map((p) => Fs[i].mins[p.name] || 0))),
    p4: games.filter((g) => g.tier === 'P4').length, home: games.filter((g) => g.venue === 'Home').length, night: games.filter((g) => envOf(g).night).length,
  };
}
export type EnvTeam = NonNullable<ReturnType<typeof envTeamOf>>;
/** Team usage for each side of a factor. */
export function envTeam(games: Game[], factor: string, opts: EngineOpts = {}): { A: EnvTeam | null; B: EnvTeam | null } {
  const { A, B } = envSplit(games, factor, opts);
  return { A: envTeamOf(A, opts), B: envTeamOf(B, opts) };
}

export interface EnvRankRow { p: string; first: string; gk: boolean; a: number; b: number; na: number; nb: number; d: number; thin: boolean }
export function envRankRowsOf(P: EnvPlayer[], games: Game[], opts: EngineOpts = {}): EnvRankRow[] {
  const all = opts.allGames ?? games, pos = posWith(opts, games);
  return P.filter((r) => r.A.apps >= 1 && r.B.apps >= 1)
    .map((r) => ({ p: r.p, first: firstOf(r.p, all), gk: pos(r.p) === 'GK', a: r.A.mpa!, b: r.B.mpa!, na: r.A.apps, nb: r.B.apps, d: r.B.mpa! - r.A.mpa!, thin: !(r.A.apps >= 2 && r.B.apps >= 2) }))
    .sort((x, y) => y.d - x.d);
}
/** Minutes-per-match ranking for a factor (opts.factor, default 'venue'). */
export function envRankRows(games: Game[], opts: EngineOpts & { factor?: string } = {}): EnvRankRow[] {
  return envRankRowsOf(envPlayers(games, opts.factor ?? 'venue', opts), games, opts);
}
