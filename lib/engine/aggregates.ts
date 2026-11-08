// Half + full-match aggregates, insights and Games-tab minutes. Port of gator-sub-board.html L675–971, L1112–1125.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Game, LoadRow } from '@/lib/types';
import { HN, avg, clk, dm, sum } from './util';
import { fullD, halfD, isSEC, loadFor, nameWith, posWith, type EngineOpts, type FullDerived, type HalfDerived, type Spell, type SubRec } from './core';

export type Agg = Record<string, any>;

// ======================================================= half stats (L675–715)
export interface TeamStats extends Agg {
  h: 1 | 2; lo: number; hi: number; n: number;
  ds: { g: Game; d: HalfDerived }[];
  subs: (SubRec & { g: Game })[];
  first: number | null; firstMin: number | null; firstMax: number | null; last: number | null;
  perGame: number; moments: number; full: number | null;
  rate: { bM: number; aM: number; bU: number; bO: number; aU: number; aO: number; bGU: number; bGO: number; aGU: number; aGO: number };
  pre: { u: number; o: number; m: number }; post: { u: number; o: number; m: number };
  win: { a: number; b: number; u: number; o: number; gu: number; go: number; s: number }[];
  bins: { a: number; n: number; list: (SubRec & { g: Game })[] }[];
  state: { k: string; n: number; avg: number | null }[];
  oppFirst: number | null; ht: number; rec: { W: number; T: number; L: number };
}

/** Half team stats. Regulation only: h=2 is [45,90] (see halfD). */
export function teamStats(games: Game[], h: 1 | 2, opts: EngineOpts = {}): TeamStats {
  const posOf = posWith(opts, games);
  const ds = games.map((g) => ({ g, d: halfD(g, h) }));
  const lo = h === 1 ? 0 : 45, hi = h === 1 ? 45 : 90;
  const subs = ds.flatMap((x) => x.d.subs.map((s) => ({ ...s, g: x.g })));
  const firsts = ds.filter((x) => x.d.first != null).map((x) => x.d.first!), lasts = ds.filter((x) => x.d.last != null).map((x) => x.d.last!);
  const outfieldFull = ds.map((x) => x.d.full.filter((p) => posOf(p) !== 'GK').length);
  const R = { bM: 0, aM: 0, bU: 0, bO: 0, aU: 0, aO: 0, bGU: 0, bGO: 0, aGU: 0, aGO: 0 };
  ds.forEach(({ d }) => {
    if (d.first == null) return;
    const f = d.first;
    R.bM += f - lo; R.aM += d.hi - f;
    d.ufShots.forEach((t) => (t < f ? R.bU++ : R.aU++)); d.oppShots.forEach((t) => (t < f ? R.bO++ : R.aO++));
    d.ufGoals.forEach((t) => (t < f ? R.bGU++ : R.aGU++)); d.oppGoals.forEach((t) => (t < f ? R.bGO++ : R.aGO++));
  });
  const pre = { u: 0, o: 0, m: 0 }, post = { u: 0, o: 0, m: 0 };
  ds.forEach(({ d }) => d.moments.forEach((mo) => {
    const a = Math.max(lo, mo.m - 10), b = Math.min(d.hi, mo.m + 10);
    pre.m += mo.m - a; post.m += b - mo.m;
    d.ufShots.forEach((t) => { if (t >= a && t < mo.m) pre.u++; else if (t > mo.m && t <= b) post.u++; });
    d.oppShots.forEach((t) => { if (t >= a && t < mo.m) pre.o++; else if (t > mo.m && t <= b) post.o++; });
  }));
  const win = [0, 15, 30].map((o) => ({ a: lo + o, b: lo + o + 15 })).map(({ a, b }) => {
    const last = b === hi;
    const inW = (t: number) => t >= a && (last ? t <= hi + 15 : t < b);
    return {
      a, b,
      u: sum(ds.map((x) => x.d.ufShots.filter(inW).length)), o: sum(ds.map((x) => x.d.oppShots.filter(inW).length)),
      gu: sum(ds.map((x) => x.d.ufGoals.filter(inW).length)), go: sum(ds.map((x) => x.d.oppGoals.filter(inW).length)),
      s: subs.filter((s) => inW(s.m)).length,
    };
  });
  const bins: TeamStats['bins'] = [];
  for (let a = lo; a < hi; a += 5) { const last = a + 5 >= hi; const list = subs.filter((s) => s.m >= a && (last ? true : s.m < a + 5)); bins.push({ a, n: list.length, list }); }
  const state = (['Winning', 'Level', 'Losing'] as const).map((k) => ({ k, n: subs.filter((s) => s.state === k).length, avg: avg(subs.filter((s) => s.state === k).map((s) => s.m)) }));
  const oppFirst = ds.filter((x) => x.d.oppSubs.length).map((x) => Math.min(...x.d.oppSubs));
  const n = games.length;
  return {
    h, lo, hi, ds, subs, n, first: avg(firsts), firstMin: firsts.length ? Math.min(...firsts) : null, firstMax: firsts.length ? Math.max(...firsts) : null,
    last: avg(lasts), perGame: n ? subs.length / n : 0, moments: n ? sum(ds.map((x) => x.d.moments.length)) / n : 0, full: avg(outfieldFull), rate: R, pre, post, win, bins, state,
    oppFirst: avg(oppFirst), ht: n ? sum(ds.map((x) => x.d.ht.length)) / n : 0,
    rec: { W: games.filter((g) => g.result === 'W').length, T: games.filter((g) => g.result === 'T').length, L: games.filter((g) => g.result === 'L').length },
  };
}

export interface HalfLog { g: Game; role: 'Start' | 'Bench'; on: number | null; off: number | null; min: number; h: 1 | 2; load?: LoadRow }
export interface PlayerHalf extends Agg {
  p: string; starts: number; offs: { m: number; g: Game }[]; full: number; apps: number; ons: { m: number; g: Game }[]; mins: number[];
  log: HalfLog[]; repl: Record<string, number>; replaced: Record<string, number>; hsr: number[]; dist: number[];
  avgOff: number | null; minOff: number | null; maxOff: number | null; avgOn: number | null; minOn: number | null; maxOn: number | null;
  avgMin: number | null; hsrPm: number | null; distPm: number | null;
}

/** Half player stats, keyed by player. L700–715. `opts` may be the loads map (stub API) or EngineOpts. */
export function playerStats(games: Game[], h: 1 | 2, loadsOrOpts?: EngineOpts | EngineOpts['loads']): Record<string, PlayerHalf> {
  const opts = toOpts(loadsOrOpts);
  const P: Record<string, PlayerHalf> = {};
  const get = (p: string) => P[p] || (P[p] = { p, starts: 0, offs: [], full: 0, apps: 0, ons: [], mins: [], log: [], repl: {}, replaced: {}, hsr: [], dist: [] } as unknown as PlayerHalf);
  games.forEach((g) => {
    const d = halfD(g, h);
    const reds = new Set(fullD(g).reds.filter((r) => r.half === h).map((r) => r.player));
    d.starters.forEach((p) => {
      const r = get(p); r.starts++;
      const o = d.subs.find((s) => s.off === p);
      if (o) { r.offs.push({ m: o.m, g }); r.repl[o.on] = (r.repl[o.on] || 0) + 1; } else if (!reds.has(p)) r.full++;
      r.log.push({ g, role: 'Start', on: d.lo, off: o ? o.m : null, min: d.minH[p] || 0, h });
    });
    d.bench.forEach((p) => {
      const r = get(p); r.apps++;
      const on = d.subs.find((s) => s.on === p);
      if (on) { r.ons.push({ m: on.m, g }); r.mins.push(d.minH[p] || 0); r.replaced[on.off] = (r.replaced[on.off] || 0) + 1; }
      const off = on ? d.subs.find((s) => s.off === p && s.t >= on.t) : null;
      r.log.push({ g, role: 'Bench', on: on ? on.m : null, off: off ? off.m : null, min: on ? d.minH[p] || 0 : 0, h });
    });
  });
  Object.values(P).forEach((r) => {
    r.log.forEach((l) => {
      const L = loadFor(opts.loads, l.g.id, r.p, h);
      if (L && l.min > 0) { l.load = L; if (L.hsr != null) r.hsr.push(L.hsr / l.min); if (L.dist != null) r.dist.push(L.dist / l.min); }
    });
    const o = r.offs.map((x) => x.m), n = r.ons.map((x) => x.m);
    Object.assign(r, {
      avgOff: avg(o), minOff: o.length ? Math.min(...o) : null, maxOff: o.length ? Math.max(...o) : null,
      avgOn: avg(n), minOn: n.length ? Math.min(...n) : null, maxOn: n.length ? Math.max(...n) : null,
      avgMin: avg(r.mins), hsrPm: avg(r.hsr), distPm: avg(r.dist),
    });
  });
  return P;
}

function toOpts(x?: EngineOpts | EngineOpts['loads']): EngineOpts {
  if (!x) return {};
  const k = Object.keys(x);
  const isOpts = k.some((q) => ['roster', 'allGames', 'loads', 'names', 'eheat'].includes(q)) || k.length === 0;
  return isOpts ? (x as EngineOpts) : { loads: x as EngineOpts['loads'] };
}

// ======================================================= full-match stats (L718–782)
export const AGE: [number, number, string][] = [[0, 10, "0–10'"], [10, 20, "10–20'"], [20, 30, "20–30'"], [30, 999, "30'+"]];
export function segments([a, b]: Spell, restarts: number[]) {
  const cuts = restarts.filter((r) => r > a && r < b);
  const pts = [a, ...cuts, b];
  const out: { s: number; e: number }[] = [];
  for (let i = 0; i < pts.length - 1; i++) out.push({ s: pts[i], e: pts[i + 1] });
  return out;
}
export interface Win { lo: number; hi: number; l: string; expo: number; f: number; a: number; gf: number; ga: number }
export const newWin = (): Win[] => AGE.map(([lo, hi, l]) => ({ lo, hi, l, expo: 0, f: 0, a: 0, gf: 0, ga: 0 }));
export function addWindows(W: Win[], spell: Spell, F: FullDerived) {
  segments(spell, F.restarts).forEach(({ s, e }) => {
    const L = e - s;
    W.forEach((w) => (w.expo += Math.max(0, Math.min(L, w.hi) - w.lo)));
    const hit = (arr: number[], k: 'f' | 'a' | 'gf' | 'ga') => arr.forEach((t) => {
      if (t > s && t <= e) { const age = t - s; const w = W.find((w) => age >= w.lo && age < w.hi); if (w) w[k]++; }
    });
    hit(F.ufShots, 'f'); hit(F.oppShots, 'a'); hit(F.ufGoals, 'gf'); hit(F.oppGoals, 'ga');
  });
}
export const per90 = (n: number, m: number) => (m > 0 ? (n / m) * 90 : null);

export interface FullLog { g: Game; sp: Spell[]; min: number; start: boolean; END: number }
export interface PlayerFull extends Agg {
  p: string; g: number; starts: number; mins: number[]; spells: number[]; nSpells: number[]; full90: number;
  exit1: number[]; ret2: number[]; exit2: number[]; entry: number[]; occ: number[]; log: FullLog[]; hsr2: number[];
  retHT: number; retLate: number[]; stayed: number; htOff: number; sp: Spell[][]; occM: number[];
  n: number; minPg: number | null; spellPg: number | null; spellLen: number | null; exit1A: number | null; exit2A: number | null;
  entryA: number | null; retLateA: number | null; hsr2Pm: number | null;
}

export function fullPlayerStats(games: Game[], loadsOrOpts?: EngineOpts | EngineOpts['loads']): Record<string, PlayerFull> {
  const opts = toOpts(loadsOrOpts);
  const P: Record<string, PlayerFull> = {};
  const get = (p: string) => P[p] || (P[p] = { p, g: 0, starts: 0, mins: [], spells: [], nSpells: [], full90: 0, exit1: [], ret2: [], exit2: [], entry: [], occ: new Array(18).fill(0), log: [], hsr2: [], retHT: 0, retLate: [], stayed: 0, htOff: 0, sp: [[], [], []], occM: new Array(90).fill(0) } as unknown as PlayerFull);
  games.forEach((g) => {
    const F = fullD(g);
    const st = new Set(g.lineup.starters.map((p) => p.name));
    Object.entries(F.spells).forEach(([p, sp]) => {
      const r = get(p); r.g++; if (st.has(p)) r.starts++; r.mins.push(F.mins[p]); r.nSpells.push(sp.length);
      sp.forEach((s, i) => {
        r.spells.push(s[1] - s[0]); if (i < 3) r.sp[i].push(s);
        for (let m = 0; m < 90; m++) r.occM[m] += Math.max(0, Math.min(s[1], m + 1) - Math.max(s[0], m));
        for (let b = 0; b < 18; b++) { const lo = b * 5, hi = lo + 5; r.occ[b] += Math.max(0, Math.min(s[1], hi) - Math.max(s[0], lo)); }
      });
      if (sp.length === 1 && sp[0][0] === 0 && sp[0][1] >= F.END) r.full90++;
      if (!st.has(p)) r.entry.push(sp[0][0]);
      if (st.has(p) && sp[0][0] === 0 && sp[0][1] < 45) r.exit1.push(sp[0][1]);
      const stayed = sp.some((s) => s[0] < 45 && s[1] > 45.05);
      if (stayed) r.stayed++;
      if (!stayed && sp.some((s) => Math.abs(s[1] - 45) < 0.05) && !sp.some((s) => s[0] >= 45)) r.htOff++;
      const r2 = sp.find((s) => s[0] >= 45 && s[0] < F.END);
      if (r2 && !stayed && sp.some((s) => s[0] < 45)) { r.ret2.push(r2[0]); if (r2[0] < 45.05) r.retHT++; else r.retLate.push(r2[0]); }
      const x2 = sp.filter((s) => s[1] > 45 && s[1] < F.END);
      if (x2.length) r.exit2.push(x2[x2.length - 1][1]);
      const L2 = loadFor(opts.loads, g.id, p, 2);
      const m2 = sum(sp.map((s) => Math.max(0, Math.min(s[1], F.END) - Math.max(s[0], 45))));
      if (L2 && L2.hsr != null && m2 > 0) r.hsr2.push(L2.hsr / m2);
      r.log.push({ g, sp, min: F.mins[p], start: st.has(p), END: F.END });
    });
  });
  Object.values(P).forEach((r) => Object.assign(r, {
    n: games.length, minPg: avg(r.mins), spellPg: avg(r.nSpells), spellLen: avg(r.spells),
    exit1A: avg(r.exit1), exit2A: avg(r.exit2), entryA: avg(r.entry), retLateA: avg(r.retLate), hsr2Pm: avg(r.hsr2),
  }));
  return P;
}

/** One-line usage pattern for a player (plain text). L746. */
export function patternText(r: Agg, _opts: EngineOpts = {}): string {
  void _opts;
  const parts: string[] = [];
  const isStarter = r.starts >= r.g / 2;
  if (isStarter) {
    parts.push('Starts');
    if (r.full90 >= Math.max(2, r.g * 0.6)) return `Usually plays the full 90 (${r.full90} of ${r.g}).`;
    if (r.exit1.length >= r.starts / 2) parts.push(`off ~${Math.round(r.exit1A)}'`);
    if (r.htOff >= r.g / 2) { parts.push('off at halftime'); return parts.join(' → ') + '.'; }
    if (r.stayed >= r.g / 2) parts.push('stays on through halftime');
    else if (r.ret2.length && r.ret2.length < r.g / 2) parts.push(`back on in ${r.ret2.length} of ${r.g}`);
    else if (r.ret2.length >= r.g / 2) parts.push(r.retHT >= r.retLate.length ? 'back on at halftime' : `back on ~${Math.round(r.retLateA)}'`);
    parts.push(r.exit2.length >= r.g / 2 ? `off ~${Math.round(avg(r.exit2)!)}'` : 'finishes the game');
  } else {
    parts.push(`Comes on ~${Math.round(r.entryA)}'`);
    if (r.spellPg >= 1.5) parts.push('usually 2 spells');
    parts.push(r.exit2.length >= r.g / 2 ? `off ~${Math.round(avg(r.exit2)!)}'` : 'often finishes');
  }
  return parts.join(' → ') + '.';
}

export type Role = 'gk' | 'anchor' | 'rotator' | 'long' | 'impact' | 'spot';
/** Rotation role. L759. Pass opts.roster/allGames for GK detection. */
export function roleOf(r: Agg, opts: EngineOpts = {}): Role {
  const pos = posWith(opts, opts.allGames ?? (r.log ?? []).map((l: FullLog) => l.g));
  if (pos(r.p) === 'GK') return 'gk';
  if (r.full90 >= Math.max(2, r.g * 0.6) || (r.starts >= r.g / 2 && r.minPg >= 80)) return 'anchor';
  if (r.starts >= r.g / 2 && r.spellPg >= 1.5) return 'rotator';
  if (r.starts >= r.g / 2) return 'long';
  if (r.g >= Math.max(2, Math.ceil((r.n || 10) * 0.4)) && r.minPg >= 18) return 'impact';
  return 'spot';
}
export const ROLES: [Role, string, string][] = [
  ['anchor', 'Anchors', 'Play (nearly) the full 90 — the full-match load benchmark'], ['long', 'One long spell', 'Start and stay on through halftime'],
  ['rotator', 'Two-spell starters', 'Start, come off in the 1st half, back on in the 2nd'], ['impact', 'Impact subs', 'Regular bench minutes, usually two spells'],
  ['spot', 'Spot minutes', 'Occasional or late minutes'], ['gk', 'Goalkeepers', ''],
];

export interface FullTeam extends Agg {
  n: number; W: Win[]; win: { a: number; b: number; subs: number; f: number; o: number; gf: number; ga: number }[];
  ht: number | null; htMin: number | null; htMax: number | null; ip: number | null; first2: number | null; f90: number | null;
  spellsPg: number | null; used: number | null; htBy: { g: Game; n: number }[];
}
export function fullTeamStats(games: Game[], opts: EngineOpts = {}): FullTeam {
  const posOf = posWith(opts, games);
  const n = games.length;
  const Fs = games.map(fullD);
  const W = newWin();
  const win: FullTeam['win'] = [];
  for (let a = 0; a < 90; a += 15) win.push({ a, b: a + 15, subs: 0, f: 0, o: 0, gf: 0, ga: 0 });
  const wOf = (t: number) => win.find((w) => t >= w.a && t < w.b) || (t >= 90 ? win[5] : null);
  Fs.forEach((F) => {
    Object.values(F.spells).forEach((sp) => sp.forEach((s) => addWindows(W, s, F)));
    F.subs.filter((s) => !s.brk).forEach((s) => { const w = wOf(s.m); if (w) w.subs++; });
    ([['ufShots', 'f'], ['oppShots', 'o'], ['ufGoals', 'gf'], ['oppGoals', 'ga']] as const).forEach(([k, f]) => F[k].forEach((t) => { const w = wOf(t); if (w) w[f]++; }));
  });
  const ht = Fs.map((F) => F.htSubs.length), ip = Fs.map((F) => F.inplay2.length), first2 = Fs.filter((F) => F.inplay2.length).map((F) => F.inplay2[0].m);
  const f90 = Fs.map((F) => Object.entries(F.spells).filter(([p, sp]) => posOf(p) !== 'GK' && sp.length === 1 && sp[0][0] === 0 && sp[0][1] >= F.END).length);
  const used = Fs.map((F) => Object.keys(F.spells).length);
  return {
    n, W, win, ht: avg(ht), htMin: ht.length ? Math.min(...ht) : null, htMax: ht.length ? Math.max(...ht) : null, ip: avg(ip), first2: avg(first2), f90: avg(f90),
    spellsPg: avg(Fs.map((F) => avg(Object.values(F.spells).map((s) => s.length))).filter((x): x is number => x != null)), used: avg(used), htBy: games.map((g, i) => ({ g, n: ht[i] })),
  };
}

// ======================================================= insights (L877–971) — HTML strings (<b> only, names escaped)
export interface InsightOpts extends EngineOpts { T?: TeamStats; P?: Record<string, PlayerHalf> }
export function insights(games: Game[], h: 1 | 2, opts: InsightOpts = {}): string[] {
  const out: string[] = [];
  if (!games.length) return out;
  const posOf = posWith(opts, games), nm = nameWith(opts);
  const T = opts.T ?? teamStats(games, h, opts), P = opts.P ?? playerStats(games, h, opts);
  const hn = HN[('h' + T.h) as 'h1' | 'h2'];
  out.push(`${T.h === 2 ? `After <b>${T.ht.toFixed(1)}</b> halftime changes, the first in-play sub` : 'First sub'} averages <b>${dm(T.first)}</b> (range ${clk(T.firstMin)}–${clk(T.firstMax)}); last sub <b>${dm(T.last)}</b>. We make <b>${T.perGame.toFixed(1)}</b> ${T.h === 2 ? 'in-play ' : ''}subs in <b>${T.moments.toFixed(1)}</b> moments per game.`);
  if (T.subs.length) {
    const busiest = T.bins.slice().sort((a, b) => b.n - a.n)[0];
    let best: { a: number; n: number } | null = null;
    for (let i = 0; i + 3 <= T.bins.length; i++) { const n = sum(T.bins.slice(i, i + 4).map((b) => b.n)); if (!best || n > best.n) best = { a: T.bins[i].a, n }; }
    out.push(`Busiest window is <b>${busiest.a}–${busiest.a + 5}'</b> (${busiest.n} of ${T.subs.length}). <b>${Math.round((best!.n / T.subs.length) * 100)}%</b> of ${hn} subs fall between ${best!.a}' and ${best!.a + 20}'.`);
  }
  const all = Object.values(P);
  const st = all.filter((r) => r.starts >= 3 && r.offs.length >= 2 && posOf(r.p) !== 'GK');
  const early = st.slice().sort((a, b) => a.avgOff! - b.avgOff!).slice(0, 4);
  if (early.length) out.push(`First off: ${early.map((r) => `<b>${nm(r.p)}</b> ${dm(r.avgOff)}`).join(', ')}.`);
  const late = st.slice().sort((a, b) => b.avgOff! - a.avgOff!).slice(0, 2);
  if (late.length) out.push(`Last off: ${late.map((r) => `<b>${nm(r.p)}</b> ${dm(r.avgOff)}`).join(', ')}.`);
  const never = all.filter((r) => r.starts >= 2 && r.offs.length === 0 && posOf(r.p) !== 'GK');
  if (never.length) out.push(`Never subbed off in the ${hn.toLowerCase()} when on at the ${T.h === 2 ? 'restart' : 'start'}: ${never.sort((a, b) => b.starts - a.starts).map((r) => `<b>${nm(r.p)}</b> (${r.starts}/${r.starts})`).join(', ')}.`);
  const vari = all.filter((r) => r.offs.length >= 3).map((r) => ({ r, sp: r.maxOff! - r.minOff! })).sort((a, b) => b.sp - a.sp).slice(0, 2);
  if (vari.length) out.push(`Least predictable exit: ${vari.map((v) => `<b>${nm(v.r.p)}</b> (${clk(v.r.minOff)}–${clk(v.r.maxOff)})`).join(', ')}. Use per-minute load, not totals.`);
  const pairs: { off: string; on: string; n: number; of: number }[] = [];
  all.forEach((r) => Object.entries(r.repl).forEach(([on, n]) => { if (n >= 3) pairs.push({ off: r.p, on, n, of: r.offs.length }); }));
  if (pairs.length) out.push(`Locked swaps: ${pairs.sort((a, b) => b.n - a.n).slice(0, 4).map((x) => `<b>${nm(x.on)}</b> for <b>${nm(x.off)}</b> ${x.n}/${x.of}`).join(', ')}.`);
  const R = T.rate;
  if (R.bM && R.aM) out.push(`After our first ${T.h === 2 ? 'in-play ' : ''}sub, Florida shots go <b>${((R.bU / R.bM) * 10).toFixed(2)} → ${((R.aU / R.aM) * 10).toFixed(2)}</b> per 10 min; opponent <b>${((R.bO / R.bM) * 10).toFixed(2)} → ${((R.aO / R.aM) * 10).toFixed(2)}</b>.`);
  return out;
}

/** Sub pattern by context table rows. L895. */
export function contextRows(games: Game[], h: 1 | 2, opts: EngineOpts = {}) {
  const defs: [string, (g: Game) => boolean][] = [['All games', () => true], ['Power 4', (g) => g.tier === 'P4'], ['SEC', isSEC], ['Non-P4', (g) => g.tier === 'Non-P4'], ['Wins', (g) => g.result === 'W'], ['Ties', (g) => g.result === 'T'], ['Losses', (g) => g.result === 'L'], ['Home', (g) => g.venue === 'Home'], ['Away', (g) => g.venue === 'Away']];
  return defs.map(([l, fn]) => { const gs = games.filter(fn); return { l, n: gs.length, T: teamStats(gs, h, { ...opts, allGames: opts.allGames ?? games }) }; }).filter((r) => r.n);
}

export interface FullInsightOpts extends EngineOpts { T?: FullTeam; P?: Record<string, PlayerFull> }
export function fullInsights(games: Game[], opts: FullInsightOpts = {}): string[] {
  const out: string[] = [];
  if (!games.length) return out;
  const posOf = posWith(opts, games), nm = nameWith(opts);
  const T = opts.T ?? fullTeamStats(games, opts), P = opts.P ?? fullPlayerStats(games, opts);
  out.push(`We change <b>${(T.ht ?? 0).toFixed(1)}</b> players at halftime (range ${T.htMin}–${T.htMax}) and make <b>${(T.ip ?? 0).toFixed(1)}</b> in-play 2H subs, the first around <b>${dm(T.first2)}</b>.`);
  const W = T.W.filter((w) => w.expo >= 200).map((w) => ({ ...w, net: per90(w.f, w.expo)! - per90(w.a, w.expo)! }));
  if (W.length > 1) {
    const lo = W.slice().sort((a, b) => a.net - b.net)[0], hi = W.slice().sort((a, b) => b.net - a.net)[0];
    out.push(`Team shot balance is strongest <b>${hi.l}</b> into players' spells and weakest <b>${lo.l}</b> in (${per90(lo.f, lo.expo)!.toFixed(1)} for, ${per90(lo.a, lo.expo)!.toFixed(1)} against per 90).`);
  }
  const all = Object.values(P);
  const regs = all.filter((r) => r.g >= Math.max(3, games.length / 2) && posOf(r.p) !== 'GK' && r.full90 < r.g / 2);
  const sh = regs.slice().sort((a, b) => a.spellLen! - b.spellLen!).slice(0, 3), lg = regs.slice().sort((a, b) => b.spellLen! - a.spellLen!).slice(0, 2);
  if (sh.length) out.push(`Shortest spells: ${sh.map((r) => `<b>${nm(r.p)}</b> ${Math.round(r.spellLen!)}'`).join(', ')}. Longest in the rotation: ${lg.map((r) => `<b>${nm(r.p)}</b> ${Math.round(r.spellLen!)}'`).join(', ')}.`);
  const f90 = all.filter((r) => r.full90 >= 2 && posOf(r.p) !== 'GK').sort((a, b) => b.full90 - a.full90);
  if (f90.length) out.push(`Full 90s: ${f90.map((r) => `<b>${nm(r.p)}</b> ${r.full90}/${r.g}`).join(', ')}. These set the full-match load benchmark.`);
  const late = T.win[5];
  out.push(`Last 15 minutes: Florida ${late.f} shots to ${late.o}, goals ${late.gf}–${late.ga}, with <b>${late.subs}</b> subs in that window.`);
  return out;
}

// ======================================================= Games tab minutes (L1112–1125)
const r1 = (v: number) => Math.round(v * 10) / 10;
export interface MinutesRow { p: string; first: string; num: string; pos: string; role: 'Start' | 'Sub'; m1: number; m2: number; full: number; x1: number; x2: number; xf: number; spells: string; firstOn: number }
export interface MinutesData { rows: MinutesRow[]; unused: string[]; END: number }

/** Per-player minutes table for one game: rows + unused bench + END. m1/m2 are regulation halves; full includes OT. */
export function minutesData(g: Game, opts: EngineOpts = {}): MinutesData {
  const posOf = posWith(opts, [g]);
  const F = fullD(g), h1 = halfD(g, 1), h2 = halfD(g, 2);
  const st = g.lineup.starters.map((p) => p.name);
  const info: Record<string, { first?: string; num?: string }> = {};
  [...g.lineup.starters, ...g.lineup.bench].forEach((p) => (info[p.name] = p));
  const played = Object.keys(F.spells);
  const order = [...st.filter((p) => played.includes(p)), ...played.filter((p) => !st.includes(p)).sort((a, b) => F.spells[a][0][0] - F.spells[b][0][0])];
  const rows = order.map((p): MinutesRow => ({
    p, first: info[p]?.first || '', num: info[p]?.num || '', pos: posOf(p), role: st.includes(p) ? 'Start' : 'Sub',
    m1: r1(h1.minH[p] || 0), m2: r1(h2.minH[p] || 0), full: r1(F.mins[p] || 0), x1: h1.minH[p] || 0, x2: h2.minH[p] || 0, xf: F.mins[p] || 0,
    spells: F.spells[p].map(([a, b]) => `${clk(a)}–${clk(b)}`).join(', '), firstOn: F.spells[p][0][0],
  }));
  const unused = g.lineup.bench.map((p) => p.name).filter((p) => !played.includes(p));
  return { rows, unused, END: F.END };
}
/** Stub API: rows only. See minutesData for unused/END. */
export function minutesRows(g: Game, opts: EngineOpts = {}): MinutesRow[] { return minutesData(g, opts).rows; }

export function sortedRows(g: Game, sort: { key: string; dir: number } = { key: 'full', dir: -1 }, opts: EngineOpts = {}): MinutesData {
  const d = minutesData(g, opts);
  const { key, dir } = sort;
  if (key === 'order') return d;
  const v = (r: MinutesRow): string | number => (key === 'spells' ? r.firstOn ?? 0 : key === 'num' ? +r.num || 0 : (r as unknown as Record<string, string | number>)[key]);
  d.rows = d.rows.map((r, i) => ({ r, i })).sort((a, b) => {
    const x = v(a.r), y = v(b.r);
    const c = typeof x === 'string' ? x.localeCompare(String(y)) : x - (y as number);
    return dir * c || a.i - b.i;
  }).map((x) => x.r);
  return d;
}
