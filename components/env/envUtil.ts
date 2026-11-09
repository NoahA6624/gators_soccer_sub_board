// Environment-tab UI helpers (EFACT / EGRP / SCOND tables, labels) ported from
// reference/gator-sub-board.html L1683–1691, L1753–1758, L2284–2287, L2213.
// Engine math (envOf/envPlayers/envTeam/envRankRows/scnCompute/chkRun) stays in '@/lib/engine'.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { envOf, isSEC } from '@/lib/engine';
import type { Game, Result } from '@/lib/types';

export type FactorKey = 'venue' | 'time' | 'heat' | 'week';
export type EnvMode = FactorKey | 'scn' | 'chk';
export type Side = 'A' | 'B';

export interface EnvUi {
  efac: EnvMode;
  eheat: number;
  egrp: string;
  eres: 'All' | Result;
  esort: { key: string; dir: 1 | -1 };
  eflip: Partial<Record<FactorKey, boolean>>;
  eopen: boolean;
  scn: Record<FactorKey, string>;
  chk: { id: string | null; inc: Record<FactorKey, boolean>; data: 'prior' | 'all' };
}

export const ENV_DEFAULT: EnvUi = {
  efac: 'venue',
  eheat: 85,
  egrp: 'all',
  eres: 'All',
  esort: { key: 'abs', dir: -1 },
  eflip: {},
  eopen: false,
  scn: { venue: 'Home', time: 'Night', heat: 'Cool', week: 'Any' },
  chk: { id: null, inc: { venue: true, time: true, heat: true, week: true }, data: 'prior' },
};

/** Safe envOf: tolerates the engine stub (returns {}) and missing fields. */
export function env(g: Game): Agg {
  try {
    return envOf(g) ?? {};
  } catch {
    return {};
  }
}
type Agg = Record<string, any>;

export const k12 = (kmin: number | null | undefined) => {
  if (kmin == null) return '—';
  const h = Math.floor(kmin / 60), m = kmin % 60;
  return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`;
};

// L2036–2040
const wkKey = (d: string) => {
  const t = new Date(d + 'T12:00:00Z');
  const dow = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dow);
  return t.toISOString().slice(0, 10);
};
const wkCache = new WeakMap<Game[], Record<string, { n: number; i: number }>>();
export function wkInfo(games: Game[]) {
  const c = wkCache.get(games);
  if (c) return c;
  const by: Record<string, Game[]> = {};
  games.forEach((g) => { (by[wkKey(g.date)] ||= []).push(g); });
  const info: Record<string, { n: number; i: number }> = {};
  Object.values(by).forEach((list) => {
    list.sort((a, b) => a.date.localeCompare(b.date));
    list.forEach((g, i) => { info[g.id] = { n: list.length, i: i + 1 }; });
  });
  wkCache.set(games, info);
  return info;
}

export interface FactorDef {
  label: string;
  A: string;
  B: string;
  grp: (g: Game, all: Game[], eheat: number) => Side | null;
  why: string;
}

// L1683–1691
export const EFACT: Record<FactorKey, FactorDef> = {
  venue: {
    label: 'Home vs Away', A: 'Home', B: 'Away',
    grp: (g) => (g.venue === 'Home' ? 'A' : g.venue === 'Away' ? 'B' : null),
    why: 'Travel, unfamiliar surfaces and crowd. Away = the stress condition.',
  },
  time: {
    label: 'Early vs Night', A: 'Night', B: 'Early',
    grp: (g) => { const e = env(g); return e.night == null ? null : e.night ? 'A' : 'B'; },
    why: 'Night = kickoff after 5:00 PM local. Anything earlier is Early, the daytime heat-and-sun condition.',
  },
  heat: {
    label: 'Heat', A: 'Cooler', B: 'Hot',
    grp: (g, _all, eheat) => { const e = env(g); return e.heat == null ? null : e.heat >= eheat ? 'B' : 'A'; },
    why: 'Air temperature at kickoff. When a dew point is entered for a match, its heat index (NWS formula) is used instead.',
  },
  week: {
    label: '1 vs 2 match weeks', A: 'Single-match week', B: 'Two-match week',
    grp: (g, all) => { const w = wkInfo(all)[g.id]; return w ? (w.n >= 2 ? 'B' : 'A') : null; },
    why: 'Weeks run Monday–Sunday. A two-match week has 2 matches in the same week (usually Thu + Sun); every other week is a single-match week. Two-match week = the congested condition.',
  },
};
export const FACTOR_KEYS = Object.keys(EFACT) as FactorKey[];

export const eLab = (k: FactorKey, side: Side, eheat: number) =>
  k === 'heat' ? (side === 'B' ? `Hot (${eheat}°F+)` : `Under ${eheat}°F`) : EFACT[k][side];
export const eShort = (k: FactorKey, side: Side, eheat: number) =>
  k === 'week' ? (side === 'B' ? '2-match wk' : '1-match wk') : k === 'heat' ? (side === 'B' ? `${eheat}°+` : `<${eheat}°`) : EFACT[k][side];

// L1753
export const EGRP: [string, string, (g: Game, all: Game[]) => boolean][] = [
  ['all', 'All matches', () => true],
  ['nc', 'Non-conference', (g) => !isSEC(g)],
  ['sec', 'SEC', (g) => isSEC(g)],
  ['p4', 'Power 4', (g) => g.tier === 'P4'],
  ['np4', 'Non-Power 4', (g) => g.tier !== 'P4'],
  ['last5', 'Last 5 matches', (g, all) => all.slice(-5).includes(g)],
  ['last3', 'Last 3 matches', (g, all) => all.slice(-3).includes(g)],
];
export const egrpOf = (k: string) => EGRP.find((x) => x[0] === k) || EGRP[0];

export const RES_OPTS: ['All' | Result, string][] = [['All', 'All results'], ['W', 'Wins'], ['T', 'Ties'], ['L', 'Losses']];

/** L1756 */
export function envSelLabel(u: EnvUi, n: number) {
  const EG = egrpOf(u.egrp);
  return `${EG[1]}${u.eres !== 'All' ? ' · ' + { W: 'Wins', T: 'Ties', L: 'Losses' }[u.eres] : ''}${u.efac === 'heat' ? ` · hot = ${u.eheat}°F+` : ''} · ${n} matches`;
}

// L1755 / L1758 — [title, more-phrase, other-phrase, B label, A label]
export const ERT: Record<FactorKey, [string, string, string, string, string]> = {
  week: ['Two-match vs single-match weeks', 'in two-match weeks', 'in single-match weeks', '2-match wk', '1-match wk'],
  venue: ['Road vs home minutes', 'on the road', 'at home', 'Away', 'Home'],
  time: ['Early vs night minutes', 'in early kickoffs', 'at night', 'Early', 'Night'],
  heat: ['Hot vs cooler minutes', 'in the heat', 'in cooler matches', 'Hot', 'Cooler'],
};
export const ERTF: Record<FactorKey, [string, string, string, string, string]> = {
  venue: ['Home vs road minutes', 'at home', 'on the road', 'Home', 'Away'],
  time: ['Night vs early minutes', 'at night', 'in early kickoffs', 'Night', 'Early'],
  heat: ['Cooler vs hot minutes', 'in cooler matches', 'in the heat', 'Cooler', 'Hot'],
  week: ['Single-match vs two-match weeks', 'in single-match weeks', 'in two-match weeks', '1-match wk', '2-match wk'],
};

// L2284–2287 (labels only; the test functions live in the engine)
export const SCOND: Record<FactorKey, { label: string; opts: [string, string][]; word: Record<string, string>; other: Record<string, string> }> = {
  venue: { label: 'Venue', opts: [['Home', 'Home'], ['Away', 'Away']], word: { Home: 'home', Away: 'away' }, other: { Home: 'away', Away: 'home' } },
  time: { label: 'Kickoff', opts: [['Night', 'Night'], ['Early', 'Early']], word: { Night: 'night', Early: 'early' }, other: { Night: 'early', Early: 'night' } },
  heat: { label: 'Temperature', opts: [['Hot', 'Hot'], ['Cool', 'Cooler']], word: { Hot: 'hot', Cool: 'cooler' }, other: { Hot: 'cooler', Cool: 'hot' } },
  week: { label: 'Week', opts: [['2', '2-match wk'], ['1', '1-match wk']], word: { '2': '2-match wk', '1': '1-match wk' }, other: { '2': '1-match wk', '1': '2-match wk' } },
};
export const scnName = (sel: [FactorKey, string][]) => sel.map(([k, v]) => SCOND[k].word[v]).join(' + ');

/** L2213 — a match's own conditions, for the impact check. */
export function chkVals(g: Game, all: Game[], eheat: number): Record<FactorKey, string | null> {
  const e = env(g), w = wkInfo(all)[g.id];
  return {
    venue: g.venue === 'Home' || g.venue === 'Away' ? g.venue : null,
    time: e.night == null ? null : e.night ? 'Night' : 'Early',
    heat: e.heat == null ? null : e.heat >= eheat ? 'Hot' : 'Cool',
    week: w ? (w.n >= 2 ? '2' : '1') : null,
  };
}

export const sgn = (v: number | null | undefined) =>
  v == null || isNaN(v) ? '—' : (v > 0.5 ? '+' : v < -0.5 ? '−' : '±') + Math.abs(Math.round(v)) + "'";
export const r0 = (v: unknown) => (typeof v === 'number' && !isNaN(v) ? Math.round(v) : '—');
export const dcls = (v: number | null | undefined) => (v == null ? '' : v >= 3 ? 'delta-dn' : v <= -3 ? 'delta-up' : '');
export const vsAt = (g: Game) => (g.venue === 'Home' ? 'vs' : 'at');
export const ppD = (g: Game) => g.date.slice(5).replace('-', '/');
