// Shared helpers for the NCAA importers (ncaaHtml.ts, ncaaCom.ts). Pure, no I/O.
import type { Game, GameEvent, LineupPlayer, Pos, Result, TeamCode } from '@/lib/types';

export const HALF_SECS = 2700;
export const OT_SECS = 600;

export function slug(s: string): string {
  return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function titleCase(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'\-.])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase())
    .replace(/\bMc([a-z])/g, (_m, c: string) => 'Mc' + c.toUpperCase());
}

/** True for the University of Florida only (not Florida St., North Florida, Florida Atlantic, FGCU, ...). */
export function isFloridaName(name: string | undefined | null): boolean {
  if (!name) return false;
  const n = name.replace(/\(.*?\)/g, ' ').replace(/#\d+/g, ' ').replace(/[^a-z ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return n === 'florida' || n === 'florida gators' || n === 'university of florida' || n === 'uf' || n === 'fla';
}

/** Looser check for a team label such as "#5 Florida (12-3-1)" or "Florida Gators": UF, not another Florida school. */
export function looksLikeFlorida(label: string | undefined | null): boolean {
  if (!label) return false;
  if (isFloridaName(label)) return true;
  return /\bflorida\b/i.test(label) && !/st\.|state|atlantic|gulf|a&m|north|south|central|international|tech|southern|memorial|poly/i.test(label);
}

export function mapPos(p: string | undefined | null): Pos {
  const s = (p || '').trim().toUpperCase();
  if (!s) return '';
  if (s.startsWith('G')) return 'GK';
  if (s.startsWith('D') || s === 'B') return 'DEF';
  if (s.startsWith('M')) return 'MID';
  if (s.startsWith('F') || s === 'A' || s === 'S') return 'FWD';
  return '';
}

export function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

export function fmtClock(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Cumulative seconds at which a period begins. 1 → 0, 2 → 2700, 3 → 5400, 4 → 6000 ... */
export function periodStart(half: number): number {
  if (half <= 1) return 0;
  if (half === 2) return HALF_SECS;
  return 2 * HALF_SECS + (half - 3) * OT_SECS;
}
export function periodLength(half: number): number {
  return half <= 2 ? HALF_SECS : OT_SECS;
}

/**
 * Name resolver: maps any spelling ("SMITH,JANE", "Jane Smith", "Smith, Jane", "J. Smith", "#7 Smith")
 * to a lineup key (last name as stored in lineup). Falls back to a title-cased last name.
 */
export interface NamedPlayer {
  name: string;
  first?: string;
  num?: string;
}
export function makeResolver(players: NamedPlayer[]) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const byFull = new Map<string, string>();
  const byLast = new Map<string, string[]>();
  const byNum = new Map<string, string>();
  for (const p of players) {
    if (p.first) {
      byFull.set(norm(p.first + p.name), p.name);
      byFull.set(norm(p.name + p.first), p.name);
    }
    const k = norm(p.name);
    byLast.set(k, [...(byLast.get(k) || []), p.name]);
    if (p.num) byNum.set(String(parseInt(p.num, 10)), p.name);
  }
  return function resolve(raw: string): string {
    let s = raw.replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/[.;:]+$/, '').trim();
    const numM = s.match(/^#?\s*(\d{1,2})\b\s*-?\s*(.*)$/);
    if (numM) {
      if (!numM[2]) return byNum.get(String(parseInt(numM[1], 10))) || numM[1];
      s = numM[2];
    }
    const f = byFull.get(norm(s));
    if (f) return f;
    let last: string;
    let first = '';
    if (s.includes(',')) {
      const [a, b] = s.split(',');
      last = a.trim();
      first = (b || '').trim();
    } else {
      const parts = s.split(' ').filter(Boolean);
      // Multi-word last names: try progressively longer suffixes against the lineup.
      for (let i = 1; i < parts.length; i++) {
        const cand = byLast.get(norm(parts.slice(i).join(' ')));
        if (cand && cand.length === 1) return cand[0];
      }
      last = parts[parts.length - 1] || s;
      first = parts.slice(0, -1).join(' ');
    }
    const cands = byLast.get(norm(last));
    if (cands && cands.length === 1) return cands[0];
    if (cands && cands.length > 1 && first) {
      const hit = players.find((p) => norm(p.name) === norm(last) && p.first && norm(p.first).startsWith(norm(first).slice(0, 1)));
      if (hit) return hit.name;
    }
    if (cands && cands.length) return cands[0];
    return titleCase(last);
  };
}

export function resultOf(gf: number, ga: number): Result {
  return gf > ga ? 'W' : gf < ga ? 'L' : 'T';
}

const P4_CONFS = new Set(['sec', 'acc', 'big-ten', 'big-12', 'big ten', 'big 12', 'pac-12']);
export function tierFor(oppConf?: string): 'P4' | 'Non-P4' | '' {
  if (!oppConf) return '';
  return P4_CONFS.has(oppConf.toLowerCase()) ? 'P4' : 'Non-P4';
}

export interface AssembleOpts {
  date?: string;
  opp: string;
  venue: Game['venue'];
  location?: string;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
  oppStarters?: { name: string; num?: string; min?: number }[];
  oppBench?: { name: string; num?: string; min?: number }[];
  events: GameEvent[];
  gf?: number;
  ga?: number;
  tier?: string;
  conf?: string;
  stage?: string;
  source?: string;
}

export function assembleGame(o: AssembleOpts, warnings: string[]): Game {
  const events = [...o.events].sort((a, b) => a.t - b.t);
  const goals = (team: TeamCode, maxHalf = 99) => events.filter((e) => e.type === 'GOAL' && e.team === team && e.half <= maxHalf).length;
  const gf = o.gf ?? goals('UF');
  const ga = o.ga ?? goals('OPP');
  if (o.gf !== undefined && goals('UF') !== o.gf) warnings.push(`Box score says Florida scored ${o.gf}, but play-by-play has ${goals('UF')} Florida goal events.`);
  if (o.ga !== undefined && goals('OPP') !== o.ga) warnings.push(`Box score says ${o.opp} scored ${o.ga}, but play-by-play has ${goals('OPP')} opponent goal events.`);
  const date = o.date || '';
  if (!date) warnings.push('No game date found; set it before saving.');
  const game: Game = {
    id: `${date || 'undated'}-${slug(o.opp || 'opponent')}`,
    date,
    opp: o.opp,
    venue: o.venue,
    gf,
    ga,
    result: resultOf(gf, ga),
    ht: { uf: goals('UF', 1), opp: goals('OPP', 1) },
    source: o.source || 'ncaa',
    tier: o.tier || '',
    lineup: { starters: o.starters, bench: o.bench },
    events,
  };
  if (o.location) game.location = o.location;
  if (o.conf) game.conf = o.conf;
  if (o.stage) game.stage = o.stage;
  if (o.oppStarters || o.oppBench) game.oppLineup = { starters: o.oppStarters || [], bench: o.oppBench || [] };
  if (!game.tier) warnings.push('Tier (P4 / Non-P4) unknown; set it before saving.');
  if (o.starters.length && o.starters.length !== 11) warnings.push(`Found ${o.starters.length} Florida starters (expected 11).`);
  return game;
}

/**
 * Compare minutes implied by SUB events against box-score minutes; warn on gaps > 3 min.
 * Returns the number of mismatched players.
 */
export function checkMinutes(game: Game, warnings: string[], endT?: number): number {
  const end = endT ?? Math.max(2 * HALF_SECS, ...game.events.map((e) => e.t));
  const on = new Map<string, number>();
  const secs = new Map<string, number>();
  for (const p of game.lineup.starters) on.set(p.name, 0);
  for (const e of game.events) {
    if (e.type !== 'SUB' || e.team !== 'UF') continue;
    if (e.off && on.has(e.off)) {
      secs.set(e.off, (secs.get(e.off) || 0) + e.t - (on.get(e.off) as number));
      on.delete(e.off);
    }
    if (e.on && !on.has(e.on)) on.set(e.on, e.t);
  }
  for (const [k, v] of on) secs.set(k, (secs.get(k) || 0) + end - v);
  let bad = 0;
  for (const p of [...game.lineup.starters, ...game.lineup.bench]) {
    if (p.min === undefined) continue;
    const implied = (secs.get(p.name) || 0) / 60;
    if (Math.abs(implied - p.min) > 3) {
      bad++;
      warnings.push(`Minutes check: ${p.name} box score ${p.min}' vs ${implied.toFixed(0)}' from subs; review subs for this player.`);
    }
  }
  return bad;
}

/**
 * Pair simultaneous sub-in / sub-out lists into SUB events (in order). Unequal counts → warnings
 * and half-filled SUB events so nothing is silently dropped.
 */
export function pairSubs(
  ins: string[],
  outs: string[],
  base: Omit<GameEvent, 'type' | 'on' | 'off'>,
  warnings: string[],
): GameEvent[] {
  const n = Math.max(ins.length, outs.length);
  const out: GameEvent[] = [];
  if (ins.length !== outs.length) {
    warnings.push(
      `${base.team === 'UF' ? 'Florida' : 'Opponent'} subs at ${base.clock} (half ${base.half}): ${ins.length} in [${ins.join(', ')}] vs ${outs.length} out [${outs.join(', ')}]; pairing in order, fill in the missing side.`,
    );
  }
  for (let i = 0; i < n; i++) {
    const ev: GameEvent = { ...base, type: 'SUB' };
    if (ins[i]) ev.on = ins[i];
    if (outs[i]) ev.off = outs[i];
    out.push(ev);
  }
  return out;
}
