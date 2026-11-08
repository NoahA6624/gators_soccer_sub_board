// Core minute/spell engine. Port of gator-sub-board.html L620–673.
// Derived results are cached in WeakMaps keyed by the Game object (never written onto the game).
import type { Filters, Game, GameEvent, LoadRow, LoadsByGame, Roster } from '@/lib/types';
import { SEC_SCHOOLS, normName, sum } from './util';
import { playerLabel, type NameIndex } from './names';

/** Spell interval in match minutes [start, end). */
export type Spell = [number, number];

/** Shared options for functions that read global board state in the original (S.roster, S.games, S.loads, S.eheat). */
export interface EngineOpts {
  /** Roster positions (S.roster). */
  roster?: Roster;
  /** The full season list (S.games) — used for position lookup, "last N", week info. Defaults to the games passed in. */
  allGames?: Game[];
  /** GPS loads (S.loads). */
  loads?: LoadsByGame;
  /** Display names: when given, text output renders players as "#19 - Mary Jane". */
  names?: NameIndex;
  /** Hot cut-off in °F (S.eheat, default 85). */
  eheat?: number;
}

export type GameState = 'Winning' | 'Level' | 'Losing';

export interface SubRec {
  i: number; // original event index
  t: number; // seconds
  m: number; // minutes (original field name)
  min: number; // minutes (alias of m)
  half: number;
  clock: string;
  on: string;
  off: string;
  /** Score at the moment of the sub (goals strictly before the sub). */
  uf: number;
  opp: number;
  state: GameState;
  /** Halftime change (made during the break, not in play). */
  ht: boolean;
  /** Any break change: halftime or an OT restart. Break subs are never "in-play". */
  brk: boolean;
  /** halfD only: this sub took off a player who was on at the start of the half (first exit). */
  starterOff?: boolean;
}

export interface RedRec { player: string; min: number; t: number; half: number }

export interface FullDerived {
  END: number;
  restarts: number[];
  spells: Record<string, Spell[]>;
  mins: Record<string, number>;
  subs: SubRec[];
  reds: RedRec[];
  /** Halftime changes. */
  htSubs: SubRec[];
  /** Changes made at an OT restart. */
  otSubs: SubRec[];
  /** In-play subs from the 2nd half on (incl. OT), excluding break changes. */
  inplay2: SubRec[];
  /** Score after all goals strictly before tMin (match minutes). */
  scoreAt: (tMin: number) => { uf: number; opp: number };
  ufShots: number[];
  ufGoals: number[];
  oppShots: number[];
  oppGoals: number[];
  oppSubs: number[];
  ev: (GameEvent & { i: number })[];
  /** Data problems found while rebuilding spells (e.g. sub where `off` wasn't on the field). */
  warnings: string[];
}

export interface HalfDerived {
  h: 1 | 2;
  lo: number;
  hi: number;
  starters: string[];
  bench: string[];
  subs: SubRec[];
  moments: { t: number; m: number; min: number; subs: SubRec[] }[];
  /** On at the start of the half and never subbed off / sent off in it. */
  full: string[];
  minH: Record<string, number>;
  pos: Record<string, Game['lineup']['starters'][number]>;
  ufShots: number[];
  ufGoals: number[];
  oppShots: number[];
  oppGoals: number[];
  oppSubs: number[];
  /** Halftime changes (same as FullDerived.htSubs). */
  ht: SubRec[];
  first: number | null;
  last: number | null;
}

const FULL = new WeakMap<Game, FullDerived>();
const HALF = new WeakMap<Game, { 1?: HalfDerived; 2?: HalfDerived }>();

const stateOf = (u: number, o: number): GameState => (u > o ? 'Winning' : u < o ? 'Losing' : 'Level');
const MAX_ON = 11;

/** Full match: spells per player, rebuilt from every sub (re-entry allowed). L622–644. */
export function fullD(g: Game): FullDerived {
  const c = FULL.get(g);
  if (c) return c;
  const ev = (g.events || []).map((e, i) => ({ ...e, i })).sort((a, b) => a.half - b.half || a.t - b.t || a.i - b.i);
  const maxHalf = Math.max(2, ...ev.map((e) => e.half));
  const END = maxHalf > 2 ? 90 + 10 * (maxHalf - 2) : 90;
  const restarts = [0, 45];
  for (let h = 3; h <= maxHalf; h++) restarts.push(90 + 10 * (h - 3));
  const warnings: string[] = [];

  const goals = ev.filter((e) => e.type === 'GOAL');
  // BUG FIX (L640): the original used `<=`, so a goal logged at the same second as a sub counted as
  // before it. A goal at the same second is treated as AFTER the sub (strict <).
  const scoreAt = (t: number) => {
    let uf = 0, opp = 0;
    goals.forEach((e) => { if (e.t / 60 < t) { if (e.team === 'UF') uf++; else opp++; } });
    return { uf, opp };
  };

  // BUG FIX (L629): halftime was only `half===2 && t===2700`. Also treat a sub at 45:00 logged as
  // half 1, and subs at an OT restart (half>=3, t on a restart boundary) as break changes.
  const isHT = (e: GameEvent) => e.t === 2700 && (e.half === 2 || e.half === 1);
  const isOTBreak = (e: GameEvent) => e.half >= 3 && restarts.some((r) => r >= 90 && Math.abs(r * 60 - e.t) < 0.5);

  const subs: SubRec[] = ev
    .filter((e) => e.type === 'SUB' && e.team === 'UF')
    .map((e) => {
      const m = e.t / 60;
      const s = scoreAt(m);
      const ht = isHT(e);
      return { i: e.i, t: e.t, m, min: m, half: e.half, clock: e.clock, on: e.on ?? '', off: e.off ?? '', uf: s.uf, opp: s.opp, state: stateOf(s.uf, s.opp), ht, brk: ht || isOTBreak(e) };
    });
  // red cards end a player's spell with no replacement (team plays a player down)
  const reds: RedRec[] = ev
    .filter((e) => e.type === 'CARD' && e.team === 'UF' && e.card === 'red' && e.player)
    .map((e) => ({ player: String(e.player), min: e.t / 60, t: e.t, half: e.half, i: e.i }));

  const on = new Map<string, number>(g.lineup.starters.map((p) => [p.name, 0]));
  const spells: Record<string, Spell[]> = {};
  const push = (p: string, s: Spell) => (spells[p] = spells[p] || []).push(s);
  type Step = { kind: 'sub'; s: SubRec } | { kind: 'red'; r: RedRec & { i: number } };
  const steps: Step[] = [
    ...subs.map((s) => ({ kind: 'sub' as const, s })),
    ...(reds as (RedRec & { i: number })[]).map((r) => ({ kind: 'red' as const, r })),
  ];
  const key = (x: Step) => (x.kind === 'sub' ? x.s : x.r);
  steps.sort((x, y) => key(x).half - key(y).half || key(x).t - key(y).t || key(x).i - key(y).i);
  for (const st of steps) {
    if (st.kind === 'red') {
      const e = st.r;
      const p = [...on.keys()].find((k) => k === e.player || k === e.player.split(',')[0].trim());
      if (p) {
        push(p, [on.get(p)!, e.min]);
        on.delete(p);
        e.player = p;
      } else warnings.push(`Red card at ${e.min.toFixed(1)}' for ${e.player}, who wasn't on the field.`);
      continue;
    }
    const e = st.s;
    if (on.has(e.off)) {
      push(e.off, [on.get(e.off)!, e.m]);
      on.delete(e.off);
    } else {
      // BUG FIX (L634): the original still added `on`, which could put a 12th player on the field.
      warnings.push(`Sub at ${e.m.toFixed(1)}': ${e.off || '(none)'} off wasn't on the field.`);
    }
    if (!on.has(e.on)) {
      if (on.size < MAX_ON) on.set(e.on, e.m);
      else warnings.push(`Sub at ${e.m.toFixed(1)}': ${e.on} not added (already ${MAX_ON} on the field).`);
    }
  }
  on.forEach((a, p) => push(p, [a, END]));
  for (const p of Object.keys(spells)) {
    const L = spells[p].filter(([a, b]) => b - a > 0.01).sort((x, y) => x[0] - y[0]);
    const M: Spell[] = [];
    L.forEach((s) => { const l = M[M.length - 1]; if (l && s[0] - l[1] < 0.05) l[1] = Math.max(l[1], s[1]); else M.push([s[0], s[1]]); });
    if (M.length) spells[p] = M; else delete spells[p];
  }
  const mins: Record<string, number> = {};
  Object.entries(spells).forEach(([p, s]) => (mins[p] = sum(s.map(([a, b]) => b - a))));
  const pick = (team: string, types: string[]) => ev.filter((e) => e.team === team && types.includes(e.type)).map((e) => e.t / 60);
  const F: FullDerived = {
    END, restarts, spells, mins, subs, ev, warnings, scoreAt,
    reds: reds.map(({ player, min, t, half }) => ({ player, min, t, half })),
    htSubs: subs.filter((s) => s.ht),
    otSubs: subs.filter((s) => s.brk && !s.ht),
    inplay2: subs.filter((s) => s.half >= 2 && !s.brk),
    ufShots: pick('UF', ['SHOT', 'GOAL']), oppShots: pick('OPP', ['SHOT', 'GOAL']),
    ufGoals: pick('UF', ['GOAL']), oppGoals: pick('OPP', ['GOAL']),
    oppSubs: ev.filter((e) => e.type === 'SUB' && e.team === 'OPP').map((e) => e.t / 60),
  };
  FULL.set(g, F);
  return F;
}

/**
 * One half. L646–665. 2nd half "starters" = on the field at the restart; in-play subs exclude halftime changes.
 *
 * BUG FIX (L646 vs L676): the original used hi=END for halfD(2) but hi=90 in teamStats. Half views are
 * now consistently REGULATION: h=1 is [0,45], h=2 is [45,90] and only half===2 events count. Overtime
 * minutes, subs and shots appear only in full-match views (fullD, fullPlayerStats, fullTeamStats, ...).
 */
export function halfD(g: Game, h: 1 | 2): HalfDerived {
  let c = HALF.get(g);
  if (!c) HALF.set(g, (c = {}));
  if (c[h]) return c[h]!;
  const F = fullD(g);
  const lo = h === 1 ? 0 : 45, hi = h === 1 ? 45 : 90;
  const inH = (e: { half: number }) => e.half === h;
  const starters = h === 1 ? g.lineup.starters.map((p) => p.name) : Object.keys(F.spells).filter((p) => F.spells[p].some((s) => s[0] <= 45.05 && s[1] > 45.05));
  const all = [...new Set([...g.lineup.starters, ...g.lineup.bench].map((p) => p.name))];
  const bench = all.filter((p) => !starters.includes(p));
  const seen: Record<string, 1> = {};
  const subs = F.subs.filter((s) => inH(s) && !s.brk).map((s) => {
    const first = !seen[s.off];
    seen[s.off] = 1;
    return { ...s, starterOff: starters.includes(s.off) && first };
  });
  const moments: HalfDerived['moments'] = [];
  subs.forEach((s) => { const l = moments[moments.length - 1]; if (l && l.t === s.t) l.subs.push(s); else moments.push({ t: s.t, m: s.m, min: s.m, subs: [s] }); });
  // BUG FIX (L657): a starter sent off with a red card did not "go the full half".
  const redH = new Set(F.reds.filter((r) => r.half === h).map((r) => r.player));
  const full = starters.filter((p) => !subs.some((s) => s.off === p) && !redH.has(p));
  const minH: Record<string, number> = {};
  Object.entries(F.spells).forEach(([p, sp]) => {
    const m = sum(sp.map(([a, b]) => Math.max(0, Math.min(b, hi) - Math.max(a, lo))));
    if (m > 0.01) minH[p] = m;
  });
  const pickH = (team: string, types: string[]) => F.ev.filter((e) => inH(e) && e.team === team && types.includes(e.type)).map((e) => e.t / 60);
  const pos: HalfDerived['pos'] = {};
  [...g.lineup.starters, ...g.lineup.bench].forEach((p) => (pos[p.name] = p));
  const D: HalfDerived = {
    h, lo, hi, starters, bench, subs, moments, full, minH, pos,
    ufShots: pickH('UF', ['SHOT', 'GOAL']), oppShots: pickH('OPP', ['SHOT', 'GOAL']),
    ufGoals: pickH('UF', ['GOAL']), oppGoals: pickH('OPP', ['GOAL']),
    oppSubs: F.ev.filter((e) => inH(e) && e.type === 'SUB' && e.team === 'OPP' && !(e.t === 2700)).map((e) => e.t / 60),
    ht: F.htSubs,
    first: subs[0] ? subs[0].m : null,
    last: subs.length ? subs[subs.length - 1].m : null,
  };
  c[h] = D;
  return D;
}
export const derive = (g: Game) => halfD(g, 1);

export const isSEC = (g: Game): boolean => (g.conf != null ? g.conf === 'SEC' : SEC_SCHOOLS.includes(normName(g.opp)));
export const isPost = (g: Game) => g.stage === 'Postseason';

/** Position: roster first, else most recent lineup appearance. L668. */
export function posOf(name: string, games: Game[], roster: Roster = {}): string {
  const o = roster[name];
  if (o && o.pos) return o.pos;
  for (let i = games.length - 1; i >= 0; i--) {
    const x = games[i];
    const q = [...x.lineup.starters, ...x.lineup.bench].find((y) => y.name === name);
    if (q && q.pos) return q.pos;
  }
  return '';
}
/** First name from the most recent lineup appearance. L669. */
export function firstOf(name: string, games: Game[]): string {
  for (let i = games.length - 1; i >= 0; i--) {
    const q = [...games[i].lineup.starters, ...games[i].lineup.bench].find((y) => y.name === name);
    if (q) return q.first || '';
  }
  return '';
}

/** Game filter bar. L671. */
export function filtered(games: Game[], f: Filters): Game[] {
  const l = games.filter((g) => (f.tier === 'All' || (f.tier === 'SEC' ? isSEC(g) : g.tier === f.tier)) && (f.result === 'All' || g.result === f.result) && (f.venue === 'All' || g.venue === f.venue));
  const n = f.recent && f.recent !== 'All' ? parseInt(String(f.recent).replace(/\D/g, ''), 10) : NaN;
  return n > 0 ? l.slice(-n) : l;
}

/** GPS row for a player/half. L672. */
export function loadFor(loads: LoadsByGame | undefined, gid: string, p: string, h: 1 | 2): LoadRow | null {
  const L = loads?.[gid];
  return L ? (L.rows || []).find((r) => r.player === p && (r.half || 1) === h) || null : null;
}

// ---- internal helpers shared by the other engine modules
export const posWith = (o: EngineOpts, games: Game[]) => (p: string) => posOf(p, o.allGames ?? games, o.roster ?? {});
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Escaped display name: playerLabel when a NameIndex is given, else the raw key. */
export const nameWith = (o: EngineOpts) => (p: string) => esc(o.names ? playerLabel(p, o.names) : p);
