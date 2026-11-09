// Importers. OWNED BY AGENT C (pdf/csv/gps/json) and AGENT E (ncaa.ts).
import type { BoardExport, Game, GameEvent, EventType, LineupPlayer, LoadRow, LoadsByGame, Pos, Result, Roster, Venue } from '@/lib/types';
import { SEC_SCHOOLS, gameId, normName } from '@/lib/engine/util';
import { parseGame } from './pdfParse';

export { parseGame, itemsToLines, parseLines, detectFormat, venueFor } from './pdfParse';
export type { TextItem, Line, ParsedGame } from './pdfParse';

export const CSV_COLS = ['game_id', 'date', 'opponent', 'venue', 'tier', 'half', 'clock', 'team', 'type', 'player', 'player_on', 'player_off', 'pos', 'num', 'detail'] as const;

// L1436–1439
export const P4 = ['alabama', 'arkansas', 'auburn', 'florida', 'georgia', 'kentucky', 'lsu', 'ole miss', 'mississippi state', 'missouri', 'oklahoma', 'south carolina', 'tennessee', 'texas', 'texas a&m', 'vanderbilt',
  'boston college', 'california', 'clemson', 'duke', 'florida state', 'georgia tech', 'louisville', 'miami', 'miami (fl)', 'nc state', 'north carolina', 'notre dame', 'pitt', 'pittsburgh', 'smu', 'stanford', 'syracuse', 'virginia', 'virginia tech', 'wake forest',
  'illinois', 'indiana', 'iowa', 'maryland', 'michigan', 'michigan state', 'minnesota', 'nebraska', 'northwestern', 'ohio state', 'oregon', 'penn state', 'purdue', 'rutgers', 'ucla', 'usc', 'washington', 'wisconsin',
  'arizona', 'arizona state', 'baylor', 'byu', 'ucf', 'cincinnati', 'colorado', 'houston', 'iowa state', 'kansas', 'kansas state', 'oklahoma state', 'tcu', 'texas tech', 'utah', 'west virginia'];
export const guessTier = (opp: string) => (P4.includes(normName(opp)) ? 'P4' : 'Non-P4');
export const guessConf = (opp: string) => (SEC_SCHOOLS.includes(normName(opp)) ? 'SEC' : 'Non-conf');
const resultOf = (u: number, o: number): Result => (u > o ? 'W' : u < o ? 'L' : 'T');

// ---------------------------------------------------------------- PDF
/** Parse box-score PDFs in the browser (pdf.js). Returns parsed games for review (not saved). L1533. */
export async function parsePdfFiles(files: File[]): Promise<{ game?: Game; file: string; error?: string }[]> {
  const { extractPages } = await import('./pdf');
  const out: { game?: Game; file: string; error?: string }[] = [];
  for (const f of files) {
    try {
      const pages = await extractPages(new Uint8Array(await f.arrayBuffer()));
      const p = parseGame(pages);
      const game: Game = { ...p, id: gameId(p.date, p.opp), tier: guessTier(p.opp), conf: guessConf(p.opp) };
      out.push({ game, file: f.name });
    } catch (e) {
      out.push({ file: f.name, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

// ---------------------------------------------------------------- CSV (L1447–1465)
export function csvParse(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

const asPos = (s: string): Pos => { const u = s.toUpperCase(); return (['GK', 'DEF', 'MID', 'FWD'].includes(u) ? u : '') as Pos; };
const asVenue = (s: string): Venue => (s === 'Away' || s === 'Neutral' ? s : 'Home');

/**
 * Tagged-event CSV → games. Rows grouped by `game_id` when present, else date|opponent.
 * `detail` column: GOAL "pk"; SHOT "sog"; CARD "yellow"/"red"; START/BENCH = first name.
 */
export function gamesFromTagCsv(text: string): Game[] {
  const rows = csvParse(text);
  if (!rows.length) throw new Error('That file has no rows.');
  const h = rows.shift()!.map((x) => x.trim().toLowerCase()); const ix = (k: string) => h.indexOf(k);
  if (ix('type') < 0 || ix('opponent') < 0 || ix('date') < 0) throw new Error('The CSV needs at least date, opponent and type columns.');
  const by = new Map<string, Game>();
  rows.forEach((r) => {
    const v = (k: string) => (ix(k) >= 0 ? (r[ix(k)] || '').trim().replace(/^'(?=[=+\-@])/, '') : '');
    const key = v('game_id') || v('date') + '|' + v('opponent');
    let g = by.get(key);
    if (!g) {
      g = { id: v('game_id') || gameId(v('date'), v('opponent')), date: v('date'), opp: v('opponent'), venue: asVenue(v('venue')), tier: v('tier') || guessTier(v('opponent')),
        conf: guessConf(v('opponent')), gf: 0, ga: 0, result: 'T', ht: { uf: 0, opp: 0 }, lineup: { starters: [], bench: [] }, events: [], source: 'manual' };
      by.set(key, g);
    }
    const type = v('type').toUpperCase();
    const detail = v('detail');
    if (type === 'START' || type === 'BENCH') {
      const p: LineupPlayer = { name: v('player'), first: detail, num: v('num'), pos: asPos(v('pos')) };
      g.lineup[type === 'START' ? 'starters' : 'bench'].push(p); return;
    }
    const clock = v('clock'); if (!/^\d{1,3}:\d{2}$/.test(clock)) return;
    const [m, s] = clock.split(':').map(Number);
    const e: GameEvent = { half: +v('half') || 1, clock, t: m * 60 + s, type: type as EventType, team: v('team').toUpperCase() === 'OPP' ? 'OPP' : 'UF' };
    const dl = detail.toLowerCase();
    if (type === 'SUB') { e.on = v('player_on'); e.off = v('player_off'); } else if (v('player')) e.player = v('player');
    if (type === 'CARD') e.card = dl === 'red' ? 'red' : 'yellow';
    if (type === 'GOAL' && dl === 'pk') e.pk = true;
    if (type === 'SHOT' && dl === 'sog') e.sog = true;
    g.events.push(e);
  });
  return [...by.values()].map((g) => {
    let u = 0, o = 0, hu = 0, ho = 0;
    g.events.forEach((e) => { if (e.type === 'GOAL') { if (e.team === 'UF') u++; else o++; if (e.half === 1) { if (e.team === 'UF') hu++; else ho++; } } });
    return { ...g, gf: u, ga: o, result: resultOf(u, o), ht: { uf: hu, opp: ho } };
  });
}

// ---------------------------------------------------------------- JSON
/** Validate + normalize a "Download all data (JSON)" file. Roster may be flat or `{players:{…}}`. */
export function parseBoardJson(text: string): BoardExport {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("That file isn't valid JSON."); }
  if (!raw || typeof raw !== 'object') throw new Error('Expected an object with games, roster and loads.');
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.games)) throw new Error('The JSON needs a "games" list.');
  const games: Game[] = o.games.map((x: unknown, i: number) => {
    if (!x || typeof x !== 'object') throw new Error(`Game ${i + 1} isn't an object.`);
    const g = { ...(x as Record<string, unknown>) } as unknown as Game & Record<string, unknown>;
    if (typeof g.date !== 'string' || typeof g.opp !== 'string') throw new Error(`Game ${i + 1} needs a date and an opponent.`);
    delete g._d; delete g._f; delete g._h; delete g.file;
    const lu = (g.lineup ?? {}) as Partial<Game['lineup']>;
    g.lineup = { starters: Array.isArray(lu.starters) ? lu.starters : [], bench: Array.isArray(lu.bench) ? lu.bench : [] };
    g.events = Array.isArray(g.events) ? g.events : [];
    g.id = typeof g.id === 'string' && g.id ? g.id : gameId(g.date, g.opp);
    g.venue = asVenue(String(g.venue ?? ''));
    g.gf = Number(g.gf) || 0; g.ga = Number(g.ga) || 0;
    g.result = g.result === 'W' || g.result === 'L' || g.result === 'T' ? g.result : resultOf(g.gf, g.ga);
    g.ht = g.ht && typeof g.ht === 'object' ? { uf: Number(g.ht.uf) || 0, opp: Number(g.ht.opp) || 0 } : { uf: 0, opp: 0 };
    g.tier = typeof g.tier === 'string' && g.tier ? g.tier : guessTier(g.opp);
    if (!g.conf) g.conf = guessConf(g.opp);
    return g as Game;
  });
  let roster: Roster = {};
  const r = o.roster as Record<string, unknown> | undefined | null;
  if (r && typeof r === 'object') roster = (r.players && typeof r.players === 'object' ? r.players : r) as Roster;
  const loads: LoadsByGame = o.loads && typeof o.loads === 'object' ? (o.loads as LoadsByGame) : {};
  return { games, roster, loads };
}

// ---------------------------------------------------------------- GPS (STATSports, L1568–1587)
export interface GpsParse {
  headers: string[];
  map: Record<'player' | 'dist' | 'hsr' | 'sprint' | 'acc' | 'dec', number>;
  rows: string[][];
}
export function parseGpsCsv(text: string): GpsParse {
  const all = csvParse(text);
  if (all.length < 2) throw new Error('That file has no rows.');
  const headers = all[0].map((h) => h.trim()); const find = (re: RegExp) => headers.findIndex((h) => re.test(h));
  const map = {
    player: find(/player|athlete|name/i), dist: find(/total distance|^distance/i), hsr: find(/high speed running|hsr|high speed distance/i),
    sprint: find(/sprint dist/i), acc: find(/accel/i), dec: find(/decel/i),
  };
  return { headers, map, rows: all.slice(1) };
}

/** Match one GPS name to lineup last names. Tiers: exact → "First Last"/"Last, First" → token. Ambiguous → null. */
export function matchGpsName(raw: string, names: string[]): string | null {
  const low = raw.trim().toLowerCase(); if (!low) return null;
  const tiers: ((n: string) => boolean)[] = [
    (n) => low === n,
    (n) => low.endsWith(' ' + n) || low.startsWith(n + ','),
    (n) => low.split(/[ ,]+/).includes(n),
  ];
  for (const test of tiers) {
    const hits = names.filter((n) => test(n.toLowerCase()));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return null; // ambiguous: leave for a manual override
  }
  return null;
}

/** Match GPS names to a game's lineup last names; manual overrides (raw name → last name) win. */
export function matchGpsRows(p: GpsParse, game: Game, half: 1 | 2, overrides?: Record<string, string>): { rows: LoadRow[]; unmatched: string[] } {
  const names = [...game.lineup.starters, ...game.lineup.bench].map((x) => x.name);
  const c = p.map;
  const num = (r: string[], k: keyof GpsParse['map']) => { const i = c[k]; if (i < 0) return null; const s = (r[i] ?? '').trim(); return s !== '' && !isNaN(+s) ? +s : null; };
  const rows: LoadRow[] = [], unmatched: string[] = [];
  for (const r of p.rows) {
    const raw = (c.player >= 0 ? r[c.player] || '' : '').trim(); if (!raw) continue;
    const ov = overrides?.[raw];
    const m = ov ? ov : matchGpsName(raw, names);
    if (!m) { unmatched.push(raw); continue; }
    const a = num(r, 'acc'), d = num(r, 'dec');
    const row: LoadRow = { player: m, half };
    const dist = num(r, 'dist'), hsr = num(r, 'hsr'), sprint = num(r, 'sprint');
    if (dist != null) row.dist = dist;
    if (hsr != null) row.hsr = hsr;
    if (sprint != null) row.sprint = sprint;
    if (a != null || d != null) row.acc = (a || 0) + (d || 0);
    rows.push(row);
  }
  return { rows, unmatched };
}
export * from './ncaaHtml';
