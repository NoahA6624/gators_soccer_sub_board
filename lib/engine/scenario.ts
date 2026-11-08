// Match scenario + impact check. Port of gator-sub-board.html L2204–2226, L2283–2299.
import type { Game } from '@/lib/types';
import { avg, sum } from './util';
import { firstOf, fullD, isSEC, posWith, type EngineOpts } from './core';
import { envOf } from './env';
import { wkInfo } from './profile';

type Ctx = { eheat: number; allGames: Game[] };
export type CondKey = 'venue' | 'time' | 'heat' | 'week';
export const SCOND: Record<CondKey, { label: string; opts: [string, string][]; test: (g: Game, v: string, c: Ctx) => boolean | null; word: Record<string, string>; other: Record<string, string> }> = {
  venue: { label: 'Venue', opts: [['Home', 'Home'], ['Away', 'Away']], test: (g, v) => (g.venue === 'Home' || g.venue === 'Away' ? g.venue === v : null), word: { Home: 'home', Away: 'away' }, other: { Home: 'away', Away: 'home' } },
  time: { label: 'Kickoff', opts: [['Night', 'Night'], ['Early', 'Early']], test: (g, v) => { const e = envOf(g); return e.night == null ? null : (v === 'Night') === e.night; }, word: { Night: 'night', Early: 'early' }, other: { Night: 'early', Early: 'night' } },
  heat: { label: 'Temperature', opts: [['Hot', 'Hot'], ['Cool', 'Cooler']], test: (g, v, c) => { const e = envOf(g); return e.heat == null ? null : (v === 'Hot') === e.heat >= c.eheat; }, word: { Hot: 'hot', Cool: 'cooler' }, other: { Hot: 'cooler', Cool: 'hot' } },
  week: { label: 'Week', opts: [['2', '2-match wk'], ['1', '1-match wk']], test: (g, v, c) => { const w = wkInfo(c.allGames)[g.id]; return w ? (v === '2') === w.n >= 2 : null; }, word: { '2': '2-match wk', '1': '1-match wk' }, other: { '2': '1-match wk', '1': '2-match wk' } },
};
export const scnName = (sel: [CondKey, string][]) => sel.map(([k, v]) => SCOND[k].word[v]).join(' + ');

export const EGRP: [string, string, (g: Game, all: Game[]) => boolean][] = [
  ['all', 'All matches', () => true], ['nc', 'Non-conference', (g) => !isSEC(g)], ['sec', 'SEC', (g) => isSEC(g)], ['p4', 'Power 4', (g) => g.tier === 'P4'],
  ['np4', 'Non-Power 4', (g) => g.tier !== 'P4'], ['last5', 'Last 5 matches', (g, all) => all.slice(-5).includes(g)], ['last3', 'Last 3 matches', (g, all) => all.slice(-3).includes(g)],
];

export interface Eff { d: number; ni: number; no: number; mi: number; mo: number }
export interface ScnRow { p: string; first: string; gk: boolean; eff: Partial<Record<CondKey, Eff>>; score: number; thin: boolean; season: number; n: number }

function core(games: Game[], sel: [CondKey, string][], o: EngineOpts) {
  const c: Ctx = { eheat: o.eheat ?? 85, allGames: o.allGames ?? games };
  const all = c.allGames, pos = posWith(o, games);
  const M: Record<string, { g: Game; m: number }[]> = {};
  games.forEach((g) => { const F = fullD(g); Object.entries(F.mins).forEach(([p, m]) => { if (m > 0.01) (M[p] = M[p] || []).push({ g, m }); }); });
  const mp = (l: { m: number }[]) => (l.length ? avg(l.map((x) => x.m))! : null);
  const rows = Object.entries(M).map(([p, l]) => {
    const eff: ScnRow['eff'] = {};
    let ok = true, thin = false;
    sel.forEach(([k, v]) => {
      const inn = l.filter((x) => SCOND[k].test(x.g, v, c) === true), out = l.filter((x) => SCOND[k].test(x.g, v, c) === false);
      if (!inn.length || !out.length) { ok = false; return; }
      if (inn.length < 2 || out.length < 2) thin = true;
      eff[k] = { d: mp(inn)! - mp(out)!, ni: inn.length, no: out.length, mi: mp(inn)!, mo: mp(out)! };
    });
    if (!ok || !sel.length) return null;
    return { p, first: firstOf(p, all), gk: pos(p) === 'GK', eff, score: sum(Object.values(eff).map((e) => e!.d)), thin, season: mp(l)!, n: l.length, l };
  }).filter((x): x is ScnRow & { l: { g: Game; m: number }[] } => x != null).sort((a, b) => b.score - a.score);
  return { rows, players: Object.keys(M).length, c, mp };
}

export function scnCore(games: Game[], sel: [CondKey, string][], opts: EngineOpts = {}) {
  const r = core(games, sel, opts);
  return { rows: r.rows.map(({ l: _l, ...x }) => { void _l; return x as ScnRow; }), players: r.players };
}

/** Combined-conditions projection. `sel` = S.scn, e.g. {venue:'Home', time:'Night', heat:'Cool', week:'Any'}. */
export function scnCompute(games: Game[], sel: Partial<Record<CondKey, string>>, opts: EngineOpts = {}) {
  const s = (Object.entries(sel) as [CondKey, string][]).filter(([k, v]) => SCOND[k] && v && v !== 'Any');
  const r = core(games, s, opts);
  const direct = games.filter((g) => s.every(([k, v]) => SCOND[k].test(g, v, r.c) === true));
  const rows = r.rows.map(({ l, ...x }) => {
    const dl = l.filter((y) => direct.includes(y.g));
    return { ...x, dAvg: r.mp(dl), dN: dl.length, dDelta: dl.length ? r.mp(dl)! - x.season : null };
  });
  return { sel: s, rows, direct, games, excluded: r.players - rows.length };
}

export function chkVals(g: Game, opts: EngineOpts = {}) {
  const e = envOf(g), w = wkInfo(opts.allGames ?? [g])[g.id], eheat = opts.eheat ?? 85;
  return {
    venue: g.venue === 'Home' || g.venue === 'Away' ? g.venue : null, time: e.night == null ? null : e.night ? 'Night' : 'Early',
    heat: e.heat == null ? null : e.heat >= eheat ? 'Hot' : 'Cool', week: w ? (w.n >= 2 ? '2' : '1') : null,
  } as Record<CondKey, string | null>;
}

export interface ChkOpts extends EngineOpts {
  /** Game to check (id). Defaults to the last game. */
  gameId?: string; egrp?: string; eres?: string;
  inc?: Partial<Record<CondKey, boolean>>; data?: 'prior' | 'all';
}
/** Impact check: projection from the pool vs what happened in one game. `games` = the full season. */
export function chkRun(games: Game[], opts: ChkOpts = {}) {
  const all = opts.allGames ?? games;
  const g = games.find((x) => x.id === opts.gameId) ?? games[games.length - 1];
  if (!g) return null;
  const EG = EGRP.find((x) => x[0] === opts.egrp) || EGRP[0];
  const eres = opts.eres ?? 'All', data = opts.data ?? 'prior', inc = { venue: true, time: true, heat: true, week: true, ...opts.inc };
  const o = { ...opts, allGames: all };
  const pool = all.filter((x) => x.id !== g.id && EG[2](x, all) && (eres === 'All' || x.result === eres) && (data === 'all' || x.date < g.date));
  const v = chkVals(g, o);
  const sel = (Object.keys(SCOND) as CondKey[]).filter((k) => inc[k] && v[k]).map((k) => [k, v[k]!] as [CondKey, string]);
  const cr = scnCore(pool, sel, o);
  const F = fullD(g);
  const st = new Set(g.lineup.starters.map((p) => p.name));
  const listed = new Set([...g.lineup.starters, ...g.lineup.bench].map((p) => p.name));
  const rows = cr.rows.map((r) => {
    const act = F.mins[r.p] || 0, played = act > 0.01, delta = played ? act - r.season : null;
    const call = r.score >= 3 ? 1 : r.score <= -3 ? -1 : 0;
    const dir = delta == null ? null : delta >= 3 ? 1 : delta <= -3 ? -1 : 0;
    const res = !played || !call ? null : dir === call ? 'hit' : dir === -call ? 'miss' : 'flat';
    return { ...r, act, played, start: st.has(r.p), listed: listed.has(r.p), delta, call, res };
  });
  const P = rows.filter((r) => r.played && !r.thin);
  const top = P.slice(0, 5), bot = P.slice(-5);
  const cnt = (k: string) => rows.filter((r) => !r.thin && r.res === k).length;
  return { g, pool, sel, v, rows, hits: cnt('hit'), miss: cnt('miss'), flat: cnt('flat'), topD: top.length ? avg(top.map((r) => r.delta!)) : null, botD: bot.length ? avg(bot.map((r) => r.delta!)) : null, nTop: top.length };
}
