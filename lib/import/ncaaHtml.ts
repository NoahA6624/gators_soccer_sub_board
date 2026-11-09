// Parser for HTML that staff save/paste from stats.ncaa.org:
//   /contests/{id}/play_by_play, /contests/{id}/box_score, /contests/{id}/individual_stats
// Any combination may be concatenated into one string (or the box score passed via opts.boxHtml).
// Pure: no network. stats.ncaa.org itself blocks automated fetches, so this is the paste path.
import * as cheerio from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { Game, GameEvent, LineupPlayer, TeamCode } from '@/lib/types';
import {
  HALF_SECS,
  assembleGame,
  checkMinutes,
  fmtClock,
  looksLikeFlorida,
  makeResolver,
  mapPos,
  pairSubs,
  periodLength,
  periodStart,
  tierFor,
  titleCase,
  toNum,
} from './ncaaShared';

export interface NcaaHtmlOpts {
  /** Box score / individual stats HTML if pasted separately from the play-by-play. */
  boxHtml?: string;
  date?: string; // YYYY-MM-DD
  venue?: Game['venue'];
  tier?: string;
  conf?: string;
  oppConf?: string;
  location?: string;
}

export interface NcaaHtmlResult {
  game: Game;
  warnings: string[];
}

interface BoxRow extends LineupPlayer {
  starter: boolean;
}
interface BoxTeam {
  team: string;
  rows: BoxRow[];
}

const clean = (s: string) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- box score

function tableLabel($: CheerioAPI, table: Cheerio<AnyNode>): string {
  const cap = clean($(table).find('caption').first().text());
  if (cap) return cap;
  const firstRow = $(table).find('tr').first();
  const cells = firstRow.children('th,td');
  if (cells.length === 1) return clean(cells.first().text());
  // Look backwards for a heading / card header.
  let el: Cheerio<AnyNode> = table;
  for (let depth = 0; depth < 4 && el.length; depth++) {
    const prev = el.prevAll('h1,h2,h3,h4,h5,h6,div,span,p,a').first();
    const txt = clean(prev.text());
    if (txt && txt.length < 80) return txt;
    el = el.parent();
  }
  return '';
}

function headerIndex(headers: string[]) {
  const find = (...re: RegExp[]) => headers.findIndex((h) => re.some((r) => r.test(h)));
  return {
    num: find(/^#$/, /^no\.?$/i, /^jersey$/i, /^num/i),
    name: find(/^(name|player)s?$/i, /player/i, /^name/i),
    pos: find(/^pos/i),
    min: find(/^(mp|min|mins|minutes)$/i, /minutes/i),
    g: find(/^(g|goals)$/i),
    a: find(/^(a|assists)$/i),
    sh: find(/^(sh|shots|s)$/i),
    gs: find(/^gs$/i, /^started$/i, /^starter$/i),
  };
}

function parseBoxTables($: CheerioAPI, warnings: string[]): BoxTeam[] {
  const teams: BoxTeam[] = [];
  $('table').each((_i, table) => {
    const rows = $(table).find('tr').toArray();
    let hdrRowIdx = -1;
    let headers: string[] = [];
    for (let i = 0; i < Math.min(rows.length, 4); i++) {
      const h = $(rows[i]).children('th,td').toArray().map((c) => clean($(c).text()));
      const idx = headerIndex(h);
      if (idx.name >= 0 && (idx.num >= 0 || idx.min >= 0 || idx.g >= 0)) {
        hdrRowIdx = i;
        headers = h;
        break;
      }
    }
    if (hdrRowIdx < 0) return;
    const idx = headerIndex(headers);
    let label = tableLabel($, $(table));
    if (headerIndex([label]).name >= 0 || label === headers.join(' ')) label = '';
    const out: BoxRow[] = [];
    let section: 'starters' | 'bench' | '' = '';
    for (const tr of rows.slice(hdrRowIdx + 1)) {
      const cellEls = $(tr).children('th,td').toArray();
      const cells = cellEls.map((c) => clean($(c).text()));
      if (cells.length === 1 || (cells.length > 0 && cells.slice(1).every((c) => !c))) {
        const t = cells[0].toLowerCase();
        if (/starter/.test(t)) section = 'starters';
        else if (/reserve|substitute|bench|subs/.test(t)) section = 'bench';
        continue;
      }
      let raw = cells[idx.name] ?? '';
      if (!raw || /^(totals?|team)$/i.test(raw)) continue;
      let starter = section === 'starters';
      if (section === '' || /\*/.test(raw)) starter = /\*/.test(raw) || starter;
      if (idx.gs >= 0) {
        const gs = (cells[idx.gs] || '').trim();
        starter = gs === '1' || gs === '*' || /^y(es)?$/i.test(gs) || gs === 'X' || gs === 'x';
      }
      const nameEl = cellEls[idx.name] ? $(cellEls[idx.name]) : null;
      if (section === '' && idx.gs < 0 && !/\*/.test(raw) && nameEl && nameEl.find('b,strong').length) starter = true;
      raw = raw.replace(/\*/g, '').trim();
      let last: string;
      let first: string | undefined;
      if (raw.includes(',')) {
        const [a, b] = raw.split(',');
        last = titleCase(a);
        first = b ? titleCase(b) : undefined;
      } else {
        const parts = raw.split(' ').filter(Boolean);
        last = titleCase(parts[parts.length - 1] || raw);
        first = parts.length > 1 ? titleCase(parts.slice(0, -1).join(' ')) : undefined;
      }
      const row: BoxRow = { name: last, starter };
      if (first) row.first = first;
      const num = idx.num >= 0 ? (cells[idx.num] || '').replace(/[^0-9]/g, '') : '';
      if (num) row.num = num;
      const pos = idx.pos >= 0 ? mapPos(cells[idx.pos]) : '';
      if (pos) row.pos = pos;
      const min = idx.min >= 0 ? toNum(cells[idx.min]) : undefined;
      if (min !== undefined) row.min = Math.round(min);
      for (const k of ['sh', 'g', 'a'] as const) {
        const v = idx[k] >= 0 ? toNum(cells[idx[k]]) : undefined;
        if (v !== undefined) row[k] = v;
      }
      out.push(row);
    }
    if (out.length) teams.push({ team: label, rows: out });
  });
  // individual_stats + box_score pasted together → same team twice; keep the richer table.
  const merged: BoxTeam[] = [];
  for (const t of teams) {
    const dup = merged.find((m) => m.team && m.team === t.team);
    if (dup) {
      if (t.rows.length > dup.rows.length) dup.rows = t.rows;
    } else merged.push(t);
  }
  if (merged.length > 2) warnings.push(`Found ${merged.length} player tables; using the first two with team labels.`);
  return merged;
}

// ---------------------------------------------------------------- play by play

interface PbpRow {
  half: number;
  clock: string; // raw
  team: 0 | 1; // column index of the team that the text belongs to
  text: string;
  score?: string;
}
interface PbpParse {
  teams: [string, string];
  rows: PbpRow[];
  lastScore?: [number, number];
}

function periodFromText(t: string): number | null {
  const s = t.toLowerCase();
  if (/1st half|first half|period 1\b|1st period/.test(s)) return 1;
  if (/2nd half|second half|period 2\b|2nd period/.test(s)) return 2;
  const ot = s.match(/(\d)?\s*(st|nd|rd|th)?\s*(ot|overtime)\s*(\d)?/);
  if (ot && /(ot|overtime)/.test(s)) return 2 + parseInt(ot[1] || ot[4] || '1', 10);
  return null;
}

function parsePbp($: CheerioAPI, warnings: string[]): PbpParse | null {
  const rows: PbpRow[] = [];
  let teams: [string, string] | null = null;
  let lastScore: [number, number] | undefined;
  let periodGuess = 0;
  $('table').each((_i, table) => {
    const trs = $(table).find('tr').toArray();
    if (!trs.length) return;
    // Header row: Time | Team A | Score | Team B
    let hdr = -1;
    let cols = { time: -1, a: -1, score: -1, b: -1 };
    for (let i = 0; i < Math.min(trs.length, 3); i++) {
      const cells = $(trs[i]).children('th,td').toArray().map((c) => clean($(c).text()));
      const time = cells.findIndex((c) => /^(time|clock)$/i.test(c));
      const score = cells.findIndex((c) => /^score$/i.test(c));
      if (time >= 0 && score >= 0 && cells.length >= 4) {
        const others = cells.map((_c, j) => j).filter((j) => j !== time && j !== score);
        cols = { time, a: others[0], score, b: others[1] };
        hdr = i;
        const ta = cells[cols.a] || $(trs[i]).children().eq(cols.a).find('img').attr('alt') || '';
        const tb = cells[cols.b] || $(trs[i]).children().eq(cols.b).find('img').attr('alt') || '';
        if (!teams && (ta || tb)) teams = [ta, tb];
        break;
      }
    }
    if (hdr < 0) return;
    let half = periodFromText(tableLabel($, $(table))) ?? periodFromText(clean($(table).find('caption').text()));
    if (!half) half = periodGuess + 1;
    periodGuess = half;
    for (const tr of trs.slice(hdr + 1)) {
      const cells = $(tr).children('th,td').toArray().map((c) => clean($(c).text()));
      if (cells.length < 4) {
        const p = cells.length ? periodFromText(cells.join(' ')) : null;
        if (p) half = periodGuess = p;
        continue;
      }
      const clock = cells[cols.time];
      const score = cells[cols.score];
      const sm = score && score.match(/(\d+)\s*-\s*(\d+)/);
      if (sm) lastScore = [parseInt(sm[1], 10), parseInt(sm[2], 10)];
      for (const [col, team] of [[cols.a, 0], [cols.b, 1]] as const) {
        const text = cells[col];
        if (text) rows.push({ half, clock, team, text, score });
      }
    }
  });
  if (!teams || !rows.length) return null;
  if (!rows.length) warnings.push('Play-by-play table found but no rows parsed.');
  return { teams, rows, lastScore };
}

/** Parse clocks for one doc. Handles mm:ss, m:ss, hh:mm:ss, mm:ss:ff, count-up per period or cumulative, count-down. */
function buildClock(rows: PbpRow[], warnings: string[]) {
  const parts = (c: string) => c.split(':').map((x) => parseInt(x, 10));
  const three = rows.some((r) => parts(r.clock).length === 3);
  // mm:ss:ff (ncaa.com style) when any 3-part clock has first part > 2; otherwise hh:mm:ss.
  const mmssff = three && rows.some((r) => {
    const p = parts(r.clock);
    return p.length === 3 && p[0] > 2;
  });
  const rawSecs = (c: string): number | null => {
    if (!c || !/\d/.test(c)) return null;
    const p = parts(c.replace(/[^0-9:]/g, ''));
    if (p.some((x) => Number.isNaN(x))) return null;
    if (p.length === 1) return p[0] * 60; // "34'" minute-only
    if (p.length === 2) return p[0] * 60 + p[1];
    if (mmssff) return p[0] * 60 + p[1];
    return p[0] * 3600 + p[1] * 60 + p[2];
  };
  const countdown = new Map<number, boolean>();
  const byHalf = new Map<number, number[]>();
  for (const r of rows) {
    const s = rawSecs(r.clock);
    if (s !== null) byHalf.set(r.half, [...(byHalf.get(r.half) || []), s]);
  }
  for (const [h, xs] of byHalf) {
    let inc = 0;
    let dec = 0;
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] > xs[i - 1]) inc++;
      else if (xs[i] < xs[i - 1]) dec++;
    }
    const cd = dec > inc;
    countdown.set(h, cd);
    if (cd) warnings.push(`Half ${h} clock counts down; converted to elapsed match time.`);
  }
  return (r: PbpRow): number | null => {
    const s = rawSecs(r.clock);
    if (s === null) return null;
    const start = periodStart(r.half);
    const len = periodLength(r.half);
    let t: number;
    if (countdown.get(r.half)) t = start + Math.max(0, len - s);
    else t = s < start ? start + s : s; // per-period count-up vs cumulative
    if (r.half >= 2 && t < start) t = start;
    return t;
  };
}

// Subs, liberal.
type SubLine = { kind: 'in' | 'out'; name: string } | { kind: 'pair'; on: string; off: string };
function parseSub(text: string): SubLine | null {
  const t = text.replace(/\s+/g, ' ').trim();
  let m = t.match(/^(?:substitution|sub)\b[^:]*:\s*(.+?)\s+(?:for|replaces|replacing)\s+(.+?)\.?$/i);
  if (m) return { kind: 'pair', on: m[1], off: m[2] };
  m = t.match(/^(.+?)\s+(?:substitutes|subs|substituted|comes on|in)\s+for\s+(.+?)\.?$/i);
  if (m && !/^(goal|shot|corner|foul|yellow|red)/i.test(m[1])) return { kind: 'pair', on: m[1], off: m[2] };
  m = t.match(/^(?:sub(?:stitution)?\s*)?(in|out)\s*[:\-]?\s*(.+)$/i);
  if (m && /^sub/i.test(t)) return { kind: m[1].toLowerCase() as 'in' | 'out', name: m[2] };
  m = t.match(/^(.+?)\s+(?:subbed|substituted|sub|subs|goes|comes)\s+(in|on|out|off)\b/i);
  if (m) return { kind: /in|on/i.test(m[2]) ? 'in' : 'out', name: m[1] };
  m = t.match(/^(?:player\s+)?(?:substitution|sub)\s+(?:on|off)\s*[:\-]?\s*(.+)$/i);
  if (m) return { kind: /\bon\b/i.test(t.split(m[1])[0]) ? 'in' : 'out', name: m[1] };
  return null;
}

const byName = (t: string) => {
  const m = t.match(/\bby\s+([^,(;]+?)(?:\s*\(|,|;|\.$|$)/i);
  return m ? m[1].trim() : '';
};

function parseOther(text: string): Omit<GameEvent, 'half' | 'clock' | 't' | 'team'> | null {
  const t = text.trim();
  if (/^(goal\b|goal by|.*\bgoal by\b|.*\bscores\b)/i.test(t) && !/goal\s*kick|goalkick|goalie|goal\s*keeper|own goal attempt/i.test(t)) {
    let player = byName(t);
    if (!player) {
      const m = t.match(/^(.+?)\s+scores/i);
      if (m) player = m[1];
    }
    const ev: Omit<GameEvent, 'half' | 'clock' | 't' | 'team'> = { type: 'GOAL', player };
    if (/penalty|\bpk\b/i.test(t)) ev.pk = true;
    return ev;
  }
  if (/\bshot\b/i.test(t) && !/shootout/i.test(t)) {
    const sog = /saved|on goal|on target|\bsog\b/i.test(t) && !/wide|high|blocked|off target|post|crossbar/i.test(t);
    let player = byName(t);
    if (!player) {
      const m = t.match(/^(?:shot\s*(?:attempt)?\s*[:\-]?\s*)?([^,(]+?)\s*(?:,|\(|shot|$)/i);
      if (m) player = m[1].replace(/^shot\s*/i, '');
    }
    return { type: 'SHOT', player, sog };
  }
  if (/yellow|red card|\bcard\b|caution|ejection/i.test(t)) {
    const red = /red|ejection/i.test(t);
    let player = byName(t);
    if (!player) {
      const m = t.match(/(?:card|caution)\s+(?:on|to)\s+([^,(]+)/i);
      if (m) player = m[1];
    }
    return { type: 'CARD', player, card: red ? 'red' : 'yellow' };
  }
  if (/corner/i.test(t)) return { type: 'CORNER' };
  return null;
}

// ---------------------------------------------------------------- main

export function parseNcaaHtml(html: string, opts: NcaaHtmlOpts = {}): NcaaHtmlResult {
  const warnings: string[] = [];
  const $ = cheerio.load(html);
  const $box = opts.boxHtml ? cheerio.load(opts.boxHtml) : $;
  const box = parseBoxTables($box, warnings);
  const pbp = parsePbp($, warnings);

  // Team names: PBP header, else box tables.
  const teamNames: [string, string] = pbp?.teams ?? [box[0]?.team || '', box[1]?.team || ''];
  const ufIdx = teamNames.findIndex((n) => looksLikeFlorida(n));
  let ufCol: 0 | 1 = ufIdx === 0 ? 0 : 1;
  if (ufIdx < 0) {
    warnings.push(`Could not find Florida among teams [${teamNames.join(' | ')}]; assuming the second (home) column.`);
    ufCol = 1;
  }
  const oppCol = (1 - ufCol) as 0 | 1;
  const opp = teamNames[oppCol] || box.find((b) => !looksLikeFlorida(b.team))?.team || 'Opponent';

  const ufBox = box.find((b) => looksLikeFlorida(b.team)) ?? (box.length === 2 ? box[ufCol] : box[0]);
  const oppBox = box.find((b) => b !== ufBox);
  if (!ufBox) warnings.push('No Florida box score found; starters/bench must be reconstructed from subs. Paste the box score page too.');

  const toLineup = (rows: BoxRow[]) => rows.map(({ starter: _s, ...p }) => p as LineupPlayer); // eslint-disable-line @typescript-eslint/no-unused-vars
  const starters = toLineup((ufBox?.rows || []).filter((r) => r.starter));
  const bench = toLineup((ufBox?.rows || []).filter((r) => !r.starter));
  if (ufBox && !starters.length) warnings.push('Box score has no starter markers (GS column, asterisk, or Starters section); all players listed as bench.');
  const oppStarters = (oppBox?.rows || []).filter((r) => r.starter).map((r) => ({ name: r.name, num: r.num, min: r.min }));
  const oppBench = (oppBox?.rows || []).filter((r) => !r.starter).map((r) => ({ name: r.name, num: r.num, min: r.min }));

  const resolveUF = makeResolver([...starters, ...bench]);
  const resolveOpp = makeResolver(oppBox?.rows || []);

  const events: GameEvent[] = [];
  if (!pbp) warnings.push('No play-by-play table found (expected columns Time | Team | Score | Team). Only the lineup was imported.');
  if (pbp) {
    const clockOf = buildClock(pbp.rows, warnings);
    // Group subs by (half, t, team) to pair simultaneous subs.
    type Moment = { half: number; t: number; team: TeamCode; ins: string[]; outs: string[]; order: number };
    const moments = new Map<string, Moment>();
    pbp.rows.forEach((r, i) => {
      let t = clockOf(r);
      if (t === null) return;
      if (r.half === 1 && t > HALF_SECS) t = HALF_SECS; // 1H stoppage time folds onto 45:00 (as in ncaaCom)
      const team: TeamCode = r.team === ufCol ? 'UF' : 'OPP';
      const resolve = team === 'UF' ? resolveUF : resolveOpp;
      const sub = parseSub(r.text);
      if (sub) {
        // Halftime subs logged at 45:00 (end of 1H or start of 2H) belong to 2H.
        const half = t === HALF_SECS ? 2 : r.half;
        const key = `${half}|${t}|${team}`;
        const m = moments.get(key) || { half, t, team, ins: [], outs: [], order: i };
        if (sub.kind === 'pair') {
          // Keep explicit pairs aligned by pushing to both sides together.
          m.ins.push(resolve(sub.on));
          m.outs.push(resolve(sub.off));
        } else if (sub.kind === 'in') m.ins.push(resolve(sub.name));
        else m.outs.push(resolve(sub.name));
        moments.set(key, m);
        return;
      }
      const other = parseOther(r.text);
      if (!other) return;
      const ev: GameEvent = { half: r.half, clock: fmtClock(t), t, team, ...other };
      if (ev.player !== undefined) {
        if (ev.player) ev.player = resolve(ev.player);
        else delete ev.player;
      }
      events.push(ev);
    });
    for (const m of moments.values()) {
      events.push(...pairSubs(m.ins, m.outs, { half: m.half, clock: fmtClock(m.t), t: m.t, team: m.team }, warnings));
    }
  }

  const ufGoals = ufBox?.rows.some((r) => r.g !== undefined) ? ufBox!.rows.reduce((s, r) => s + (r.g || 0), 0) : undefined;
  const oppGoals = oppBox?.rows.some((r) => r.g !== undefined) ? oppBox!.rows.reduce((s, r) => s + (r.g || 0), 0) : undefined;
  let gf: number | undefined;
  let ga: number | undefined;
  if (pbp?.lastScore) {
    gf = pbp.lastScore[ufCol];
    ga = pbp.lastScore[oppCol];
  } else {
    gf = ufGoals;
    ga = oppGoals; // own goals are not credited to a player; PBP score preferred when present
  }

  const dateM = !opts.date ? (html + (opts.boxHtml || '')).match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/) : null;
  const date = opts.date || (dateM ? `${dateM[3]}-${dateM[1].padStart(2, '0')}-${dateM[2].padStart(2, '0')}` : '');
  let venue = opts.venue;
  if (!venue) {
    venue = ufCol === 1 ? 'Home' : 'Away';
    warnings.push(`Venue inferred as ${venue} from column order (stats.ncaa.org lists the home team second); check for neutral sites.`);
  }

  const game = assembleGame(
    {
      date,
      opp: titleCaseTeam(opp),
      venue,
      location: opts.location,
      starters,
      bench,
      oppStarters: oppBox ? oppStarters : undefined,
      oppBench: oppBox ? oppBench : undefined,
      events,
      gf,
      ga,
      tier: opts.tier || tierFor(opts.oppConf),
      conf: opts.conf ?? (opts.oppConf ? (opts.oppConf.toLowerCase() === 'sec' ? 'SEC' : 'Non-conf') : undefined),
      source: 'ncaa',
    },
    warnings,
  );
  if (starters.length) checkMinutes(game, warnings, Math.max(2 * HALF_SECS, ...events.map((e) => e.t)));
  return { game, warnings };
}

function titleCaseTeam(s: string): string {
  // Keep "St." / acronyms as given; strip rankings like "#12".
  return s.replace(/#\d+\s*/g, '').replace(/\(\d+-\d+(-\d+)?\)/g, '').trim();
}
