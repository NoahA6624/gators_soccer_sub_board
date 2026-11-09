// Pure box-score / play-by-play parser (port of SubParser IIFE, gator-sub-board.html L376–587).
// Input: pages -> array of text items {str, x, y} (as pulled from pdf.js). No DOM, runs in node.
//
// Shot/goal rule: SHOTS INCLUDE GOALS. A goal is stored exactly once, as a GOAL event, and never as a
// SHOT event. Consumers count shots as SHOT + GOAL. Play-by-play lines like "Shot by FLA Smith, Jane, GOAL"
// (which StatCrew prints next to a separate "GOAL by …" line) are dropped when a matching GOAL exists, or
// converted to the GOAL when no separate line exists (fixes the double count at original L531–537).
import type { GameEvent, Lineup, LineupPlayer, OppLineupPlayer, Pos, Result, TeamCode, Venue, GameEnv } from '@/lib/types';
import { gameId } from '@/lib/engine/util';

export interface TextItem { str: string; x: number; y: number }
export interface Line { page: number; items: TextItem[]; text: string }

/** Parsed game (no tier/conf yet: those are defaults added by parsePdfFiles). */
export interface ParsedGame {
  id: string;
  date: string;
  opp: string;
  venue: Venue;
  location: string;
  gf: number;
  ga: number;
  result: Result;
  ht: { uf: number; opp: number };
  source: 'pdf';
  env?: GameEnv;
  lineup: Lineup;
  oppLineup: { starters: OppLineupPlayer[]; bench: OppLineupPlayer[] };
  events: GameEvent[];
}

const UF_NAMES = ['Florida'];

/** L383: group items into lines by y (tolerance 2.5), top to bottom, items left to right. */
export function itemsToLines(pages: TextItem[][]): Line[] {
  const lines: Line[] = [];
  pages.forEach((items, pi) => {
    const rows: { y: number; items: TextItem[] }[] = [];
    items.filter((it) => it.str && it.str.trim()).forEach((it) => {
      let row = rows.find((r) => Math.abs(r.y - it.y) < 2.5);
      if (!row) { row = { y: it.y, items: [] }; rows.push(row); }
      row.items.push(it);
    });
    rows.sort((a, b) => b.y - a.y);
    rows.forEach((r) => {
      r.items.sort((a, b) => a.x - b.x);
      lines.push({ page: pi, items: r.items, text: r.items.map((i) => i.str.trim()).join(' ').replace(/\s+/g, ' ').trim() });
    });
  });
  return lines;
}

const clockToSec = (c: string) => { const [m, s] = c.split(':').map(Number); return m * 60 + s; };
const lastName = (full: string) => full.split(',')[0].trim();
const firstName = (full: string) => (full.split(',')[1] || '').trim();
const asPos = (s: string | undefined): Pos => { const u = (s || '').toUpperCase(); return (['GK', 'DEF', 'MID', 'FWD'].includes(u) ? u : '') as Pos; };
const resultOf = (uf: number, op: number): Result => (uf > op ? 'W' : uf < op ? 'L' : 'T');
const isGoalShot = (play: string) => /\bGOAL\b/.test(play);

// Opponent home cities (lowercase match against the location line) for Neutral detection.
// TODO: extend this list (or source it from the NCAA importer) — unknown opponents fall back to Away.
const OPP_CITY: Record<string, string[]> = {
  alabama: ['tuscaloosa'], arkansas: ['fayetteville'], auburn: ['auburn'], georgia: ['athens'], kentucky: ['lexington'],
  lsu: ['baton rouge'], 'ole miss': ['oxford'], 'mississippi state': ['starkville'], missouri: ['columbia'], oklahoma: ['norman'],
  'south carolina': ['columbia'], tennessee: ['knoxville'], texas: ['austin'], 'texas a&m': ['college station'], vanderbilt: ['nashville'],
  'florida state': ['tallahassee'], ucf: ['orlando'], miami: ['coral gables', 'miami'], 'miami (fl)': ['coral gables', 'miami'],
  usf: ['tampa'], 'south florida': ['tampa'], fgcu: ['fort myers'], 'florida gulf coast': ['fort myers'], fau: ['boca raton'],
  'florida atlantic': ['boca raton'], fiu: ['miami'], 'north florida': ['jacksonville'], jacksonville: ['jacksonville'],
  stetson: ['deland'], clemson: ['clemson'], duke: ['durham'], 'north carolina': ['chapel hill'], 'georgia tech': ['atlanta'],
};

/** Home if Gainesville; Away if the location is the opponent's city or unknown; Neutral if we know the
 *  opponent's city and the location is somewhere else. */
export function venueFor(location: string, opp: string): Venue {
  const loc = (location || '').toLowerCase();
  if (/gainesville/.test(loc)) return 'Home';
  if (!loc.trim()) return 'Away';
  const o = opp.toLowerCase().replace(/[^a-z&() ]/g, '').replace(/\s+/g, ' ').trim();
  const cities = OPP_CITY[o];
  if (cities) return cities.some((c) => loc.includes(c)) ? 'Away' : 'Neutral';
  // Location mentions the opponent's own name (e.g. "Auburn, Ala.") → their place.
  if (o && loc.includes(o)) return 'Away';
  // TODO: unknown opponent city; cannot tell Away from Neutral. Default Away (user can fix in review).
  return 'Away';
}

interface RawEvent extends GameEvent { code?: string; goalShot?: boolean }

/** Collapse "Shot … GOAL" rows: drop if a GOAL by the same team at the same clock exists, else convert. */
function resolveGoalShots(events: RawEvent[]): GameEvent[] {
  const goals = events.filter((e) => e.type === 'GOAL');
  const out: GameEvent[] = [];
  for (const e of events) {
    if (e.type === 'SHOT' && e.goalShot) {
      const dup = goals.some((g) => g.team === e.team && g.half === e.half && Math.abs(g.t - e.t) <= 1);
      if (dup) continue;
      const g: GameEvent = { half: e.half, clock: e.clock, t: e.t, type: 'GOAL', team: e.team, player: e.player };
      if (/PENALTY/i.test(String((e as { play?: string }).play ?? ''))) g.pk = true;
      out.push(g);
      continue;
    }
    const c: RawEvent = { ...e };
    delete c.code; delete c.goalShot; delete (c as { play?: string }).play;
    if (c.sog === undefined) delete c.sog;
    if (c.pk === undefined) delete c.pk;
    out.push(c);
  }
  return out;
}

function scoreOf(ev: GameEvent[]) {
  let uf = 0, op = 0; const ht = { uf: 0, opp: 0 };
  ev.forEach((e) => { if (e.type === 'GOAL') { if (e.team === 'UF') uf++; else op++; } if (e.half === 1) { ht.uf = uf; ht.opp = op; } });
  return { uf, op, ht };
}

// ---------- Format A: StatCrew (L405–435 box, L499–571 game)
interface BoxRow { name: string; first: string; num: string; pos: Pos; role: 'S' | 'B'; sh: number; sog: number; g: number; a: number; min: number }
function parseBox(lines: Line[]): { uf: BoxRow[]; opp: BoxRow[] } {
  const hi = lines.findIndex((l) => l.items.filter((i) => i.str.trim() === 'Pos').length >= 2);
  if (hi < 0) throw new Error("Couldn't find the box score table.");
  const posItems = lines[hi].items.filter((i) => i.str.trim() === 'Pos');
  const splitX = posItems[1].x - 4;
  let ufLeft: boolean | null = null;
  for (let i = hi - 1; i >= 0 && i > hi - 12; i--) {
    const L = lines[i];
    const left = L.items.filter((it) => it.x < splitX).map((i) => i.str.trim()).join(' ');
    const right = L.items.filter((it) => it.x >= splitX).map((i) => i.str.trim()).join(' ');
    if (/^Florida\s+\d+$/.test(left.trim())) { ufLeft = true; break; }
    if (/^Florida\s+\d+$/.test(right.trim())) { ufLeft = false; break; }
  }
  if (ufLeft === null) throw new Error("Couldn't tell which column is Florida.");
  const side = (L: Line, uf: boolean) => L.items.filter((it) => (uf === ufLeft ? it.x < splitX : it.x >= splitX)).map((i) => i.str.trim()).join(' ').replace(/\s+/g, ' ').trim();
  const read = (uf: boolean) => {
    const out: BoxRow[] = []; let sec: 'S' | 'B' | null = null;
    for (let i = hi + 1; i < Math.min(lines.length, hi + 45); i++) {
      const t = side(lines[i], uf);
      if (/^Totals\b/.test(t) || / Totals /.test(' ' + t + ' ')) break;
      if (/^Starters$/.test(t)) { sec = 'S'; continue; }
      if (/^Substitutes$/.test(t)) { sec = 'B'; continue; }
      const m = t.match(/^(?:(GK|DEF|MID|FWD)\s+)?(\d+)\s+(.+?,\s*.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/);
      if (m && sec) out.push({ name: lastName(m[3]), first: firstName(m[3]), num: m[2], pos: asPos(m[1]), role: sec, sh: +m[4], sog: +m[5], g: +m[6], a: +m[7], min: +m[8] });
    }
    return out;
  };
  return { uf: read(true), opp: read(false) };
}

function parseGameA(lines: Line[]): ParsedGame {
  const all = lines.map((l) => l.text);
  const txt = all.join('\n');
  const tl = all.find((t) => / -vs- /.test(t)) || '';
  const tm = tl.match(/^(.*?)\s*\([^)]*\)\s*-vs-\s*(.*?)\s*\([^)]*\)/);
  const teamA = tm ? tm[1].trim() : '', teamB = tm ? tm[2].trim() : '';
  const opp = UF_NAMES.includes(teamA) ? teamB : teamA;
  // Fix: accept 1-digit month/day.
  const dm = txt.match(/Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const date = dm ? `${dm[3]}-${dm[1].padStart(2, '0')}-${dm[2].padStart(2, '0')}` : '';
  const locLine = all.find((t) => /^\d{1,2}\/\d{1,2}\/\d{4} at /.test(t)) || '';
  const location = locLine.replace(/^\d{1,2}\/\d{1,2}\/\d{4} at /, '');
  const venue = venueFor(location, opp);
  const box = parseBox(lines);
  const ufSet = new Set(box.uf.map((p) => p.name)), oppSet = new Set(box.opp.map((p) => p.name));

  const pi = all.findIndex((t) => /Play By Play/.test(t));
  const events: RawEvent[] = []; let half = 1;
  const codes: Record<string, { uf: number; opp: number }> = {};
  for (let i = pi + 1; i < all.length; i++) {
    const m = all[i].match(/^(\d{1,3}:\d{2})\s+(\S+)\s+(.*)$/);
    if (!m) continue;
    const [, clock, code, play] = m;
    if (/End of period/i.test(play)) { half++; continue; }
    if (/Start of .* period/i.test(play) || /at goalie for/i.test(play)) continue;
    const base = { half, clock, t: clockToSec(clock), code, team: 'UF' as TeamCode };
    let s: RegExpMatchArray | null;
    if ((s = play.match(/substitution:\s*(.+?)\s+for\s+(.+?)\.?$/))) {
      events.push({ ...base, type: 'SUB', on: lastName(s[1]), off: lastName(s[2]) });
    } else if (/GOAL/.test(play) && !/^Shot/.test(play)) {
      const g = play.match(/GOAL by \S+ (.+?)(?: Assist by (.+?))?\.?$/);
      let scorer = g ? lastName(g[1]) : '';
      if (!g) { const pk = play.match(/^\S+\s+(.+?)\s+PENALTY KICK GOAL/); if (pk) { const parts = pk[1].trim().split(' '); scorer = lastName(parts[parts.length - 1]); } }
      events.push({ ...base, type: 'GOAL', player: scorer, pk: /PENALTY/.test(play) || undefined });
    } else if ((s = play.match(/^Shot by \S+ (.+?),\s*([^,]+?)(?:,|\.|$)/))) {
      events.push({ ...base, type: 'SHOT', player: s[1].trim(), sog: /saved|SAVE/i.test(play) || undefined, goalShot: isGoalShot(play) || undefined, ...(isGoalShot(play) ? { play } : {}) } as RawEvent);
    } else if (/^Corner kick/i.test(play)) {
      events.push({ ...base, type: 'CORNER' });
    } else if ((s = play.match(/(Yellow|Red) card on \S+ (.+?),/i))) {
      events.push({ ...base, type: 'CARD', card: s[1].toLowerCase() as 'yellow' | 'red', player: s[2].trim() });
    } else if (/^Foul on/i.test(play)) {
      events.push({ ...base, type: 'FOUL' });
    } else if (/^Offside/i.test(play)) {
      events.push({ ...base, type: 'OFFSIDE' });
    }
  }
  events.filter((e) => e.type === 'SUB').forEach((e) => {
    const c = (codes[e.code!] = codes[e.code!] || { uf: 0, opp: 0 });
    if (ufSet.has(e.off!) || ufSet.has(e.on!)) c.uf++;
    if (oppSet.has(e.off!) || oppSet.has(e.on!)) c.opp++;
  });
  let ufCode = Object.entries(codes).sort((a, b) => (b[1].uf - b[1].opp) - (a[1].uf - a[1].opp))[0]?.[0];
  if (!ufCode) { const c = txt.match(/GOAL by (UFLOR|FLA|UF)\b/); ufCode = c ? c[1] : 'FLA'; }
  const kept = events.filter((e) => e.code !== '0');
  kept.forEach((e) => { e.team = e.code === ufCode ? 'UF' : 'OPP'; });
  const clean = resolveGoalShots(kept);
  const { uf, op, ht } = scoreOf(clean);
  const mk = (p: BoxRow): LineupPlayer => ({ name: p.name, first: p.first, num: p.num, pos: p.pos, min: p.min, sh: p.sh, g: p.g, a: p.a });
  const om = (p: BoxRow): OppLineupPlayer => ({ name: p.name, num: p.num, min: p.min });
  return {
    id: gameId(date, opp), date, opp, venue, location, gf: uf, ga: op, result: resultOf(uf, op), ht, source: 'pdf',
    lineup: { starters: box.uf.filter((p) => p.role === 'S').map(mk), bench: box.uf.filter((p) => p.role === 'B').map(mk) },
    oppLineup: { starters: box.opp.filter((p) => p.role === 'S').map(om), bench: box.opp.filter((p) => p.role === 'B').map(om) },
    events: clean,
  };
}

// ---------- Format B: "Official Soccer Box Score" (L440–498)
const UF_TOK = new Set(['Gators', 'Florida', 'FLA', 'UF', 'UFLOR']);
interface BoxB { full: string; num: string; pos: Pos; role: 'S' | 'B'; sh: number; g: number; a: number; min: number }

function parseGameB(lines: Line[]): ParsedGame {
  const all = lines.map((l) => l.text); const txt = all.join('\n');
  const tl = all.find((t) => /^(.+?)\s+vs\.?\s+(.+)$/.test(t) && /Florida/.test(t) && !/\(/.test(t)) || '';
  const tm = tl.match(/^(.+?)\s+vs\.?\s+(.+)$/);
  const opp = tm ? (UF_NAMES.includes(tm[1].trim()) ? tm[2].trim() : tm[1].trim()) : '';
  const dm = txt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const date = dm ? `${dm[3]}-${dm[1].padStart(2, '0')}-${dm[2].padStart(2, '0')}` : '';
  const locLine = all.find((t) => /^\d{1,2}\/\d{1,2}\/\d{4}\s+\S/.test(t)) || '';
  const location = locLine.replace(/^\d{1,2}\/\d{1,2}\/\d{4}\s+/, '');
  const venue = venueFor(location, opp);
  const km = txt.match(/Match Time:\s*(\d{1,2}):(\d{2})\s*([AP])\.?M/i);
  const env: GameEnv | undefined = km ? { kickoff: String((+km[1] % 12) + (/p/i.test(km[3]) ? 12 : 0)).padStart(2, '0') + ':' + km[2], kickoffSrc: 'box score (local)' } : undefined;
  const hi = lines.findIndex((l) => l.items.filter((i) => /^Pos\b/.test(i.str.trim())).length >= 2);
  if (hi < 0) throw new Error("Couldn't find the box score table.");
  const posIt = lines[hi].items.filter((i) => /^Pos\b/.test(i.str.trim())); const splitX = posIt[1].x - 4;
  const hdr = lines[hi - 1]; const leftHdr = hdr ? hdr.items.filter((i) => i.x < splitX).map((i) => i.str.trim()).join(' ').trim() : '';
  const ufLeft = /^Florida\b/.test(leftHdr);
  const side = (L: Line, uf: boolean) => L.items.filter((it) => (uf === ufLeft ? it.x < splitX : it.x >= splitX)).map((i) => i.str.trim()).join(' ').replace(/\s+/g, ' ').trim();
  const readBox = (uf: boolean) => {
    const out: BoxB[] = []; let sec: 'S' | 'B' = 'S';
    for (let i = hi + 1; i < Math.min(lines.length, hi + 60); i++) {
      const t = side(lines[i], uf);
      if (/^Totals\b/.test(t)) { if (sec === 'B') break; continue; }
      if (/Substitutes/.test(t)) { sec = 'B'; continue; }
      if (/Goalkeepers/.test(t)) break;
      const m = t.match(/^(?:(gk|def|mid|fwd|GK|DEF|MID|FWD)\s+)?(\d+)\s+(.+?)\s+([\d-]+)\s+([\d-]+)\s+([\d-]+)\s+([\d-]+)\s+([\d-]+)\s+(\d+)$/);
      if (m) { const n = (v: string) => (v === '-' ? 0 : +v); out.push({ full: m[3].trim(), num: m[2], pos: asPos(m[1]), role: sec, sh: n(m[4]), g: n(m[6]), a: n(m[7]), min: +m[9] }); }
    }
    return out;
  };
  const boxUF = readBox(true), boxOpp = readBox(false);
  const ev: RawEvent[] = []; let half = 1; const pbpNames = new Set<string>();
  const si = lines.findIndex((l) => /Starters:/.test(l.text));
  let starters: { name: string; first: string; num: string; pos: Pos }[] = [];
  if (si >= 0) {
    const L0 = lines[si];
    const itUF = L0.items.find((i) => /^Florida\b.*Starters:/.test(i.str.trim())) || L0.items[0];
    const itOp = L0.items.find((i) => i !== itUF && /Starters:/.test(i.str));
    const cut = itOp ? Math.max(itOp.x, itUF.x) - 4 : 1e9; const ufIsLeft = !itOp || itUF.x < itOp.x;
    for (let i = si + 1; i < lines.length; i++) {
      const L = lines[i]; if (/^\d{1,3}:\d{2}\s/.test(L.text)) break;
      const t = L.items.filter((it) => (ufIsLeft ? it.x < cut : it.x >= cut)).map((x) => x.str.trim()).join(' ').replace(/\s+/g, ' ').trim();
      const m = t.match(/^(?:(GK|DEF|MID|FWD)\s+)?(\d+)\s+(.+?,\s*.+)$/i);
      if (m) starters.push({ name: lastName(m[3]), first: firstName(m[3]), num: m[2], pos: asPos(m[1]) });
    }
  }
  const isUF = (tok: string) => UF_TOK.has(tok);
  const tm2 = (tok: string): TeamCode => (isUF(tok) ? 'UF' : 'OPP');
  for (const t of all) {
    const m = t.match(/^(\d{1,3}:\d{2})\s+(.*)$/); if (!m) continue; const [, clock, play] = m;
    if (/End of period/i.test(play)) { half++; continue; }
    if (/Start of .* period|at goalie for|^Official/i.test(play)) continue;
    const base = { half, clock, t: clockToSec(clock) }; let s: RegExpMatchArray | null;
    if ((s = play.match(/^(\S+(?: \S+)?) substitution:\s*(.+?)\s+for\s+(.+?)\.?$/))) {
      pbpNames.add(s[2].trim()); pbpNames.add(s[3].trim());
      ev.push({ ...base, type: 'SUB', team: tm2(s[1].split(' ')[0]), on: lastName(s[2]), off: lastName(s[3]) });
    } else if ((s = play.match(/^GOAL by (\S+) (.+?)(?:,|\(|$)/))) {
      ev.push({ ...base, type: 'GOAL', team: tm2(s[1]), player: lastName(s[2]), ...(/PENALTY/i.test(play) ? { pk: true } : {}) });
    } else if ((s = play.match(/^(\S+) (.+?,\s*.+?) PENALTY KICK GOAL/i))) {
      ev.push({ ...base, type: 'GOAL', team: tm2(s[1]), player: lastName(s[2]), pk: true });
    } else if ((s = play.match(/^Shot by (\S+) (.+?)(?:,|\s+(?:WIDE|HIGH|BLOCKED|OFF|HIT|SAVE)|\.|$)/))) {
      const gs = isGoalShot(play);
      ev.push({ ...base, type: 'SHOT', team: tm2(s[1]), player: lastName(s[2]), sog: /SAVE/.test(play) || undefined, goalShot: gs || undefined, ...(gs ? { play } : {}) } as RawEvent);
    } else if ((s = play.match(/^Corner kick by (\S+)/))) {
      ev.push({ ...base, type: 'CORNER', team: tm2(s[1]) });
    } else if ((s = play.match(/^(Yellow|Red) card on (\S+) (.+?)(?:,|\.)/i))) {
      ev.push({ ...base, type: 'CARD', card: s[1].toLowerCase() as 'yellow' | 'red', team: tm2(s[2]), player: lastName(s[3]) });
    } else if ((s = play.match(/^Foul on (.+?)\.?$/))) {
      ev.push({ ...base, type: 'FOUL', team: /Florida|Gators/.test(s[1]) ? 'UF' : 'OPP' });
    } else if ((s = play.match(/^Offside against (.+?)\.?$/))) {
      ev.push({ ...base, type: 'OFFSIDE', team: /Florida|Gators/.test(s[1]) ? 'UF' : 'OPP' });
    }
  }
  const events = resolveGoalShots(ev);
  const toLast = (full: string) => {
    for (const n of pbpNames) { if (`${firstName(n)} ${lastName(n)}` === full) return lastName(n); }
    const parts = full.split(' '); return parts[parts.length - 1];
  };
  const boxByLast: Record<string, BoxB> = {}; boxUF.forEach((p) => (boxByLast[toLast(p.full)] = p));
  if (!starters.length) starters = boxUF.filter((p) => p.role === 'S').map((p) => ({ name: toLast(p.full), first: p.full.split(' ')[0], num: p.num, pos: p.pos }));
  const stSet = new Set(starters.map((p) => p.name));
  const lineupStarters: LineupPlayer[] = starters.map((p) => {
    const b = boxByLast[p.name];
    return { name: p.name, first: p.first || '', num: p.num, pos: p.pos || b?.pos || '', min: b?.min, sh: b?.sh || 0, g: b?.g || 0, a: b?.a || 0 };
  });
  const bench: LineupPlayer[] = boxUF.filter((p) => p.role === 'B').map((p) => {
    const l = toLast(p.full);
    return { name: l, first: p.full.split(' ').slice(0, -1).join(' '), num: p.num, pos: p.pos, min: p.min, sh: p.sh, g: p.g, a: p.a };
  }).filter((p) => !stSet.has(p.name));
  const { uf, op, ht } = scoreOf(events);
  const om = (p: BoxB): OppLineupPlayer => ({ name: p.full, num: p.num, min: p.min });
  const out: ParsedGame = {
    id: gameId(date, opp), date, opp, venue, location, gf: uf, ga: op, result: resultOf(uf, op), ht, source: 'pdf',
    lineup: { starters: lineupStarters, bench },
    oppLineup: { starters: boxOpp.filter((p) => p.role === 'S').map(om), bench: boxOpp.filter((p) => p.role === 'B').map(om) },
    events,
  };
  if (env) out.env = env;
  return out;
}

/** L502 sniff: Format B has a "Starters:" block and no " -vs- " title. */
export function detectFormat(lines: Line[]): 'A' | 'B' {
  const all = lines.map((l) => l.text);
  return !all.some((t) => / -vs- /.test(t)) && all.some((t) => /Starters:/.test(t)) ? 'B' : 'A';
}

export function parseLines(lines: Line[]): ParsedGame {
  return detectFormat(lines) === 'B' ? parseGameB(lines) : parseGameA(lines);
}

export function parseGame(pages: TextItem[][]): ParsedGame {
  return parseLines(itemsToLines(pages));
}
