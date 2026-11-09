// ncaa.com game-center feed (sdataprod.ncaa.com GraphQL, persisted queries) → Game. Pure, no I/O.
// The fetching lives in app/api/ncaa/route.ts; this file only knows the response shapes.
//
// Findings (2026-11): the PBP feed lists substitutions as single "Sub in First Last" lines with no
// "Sub out" and no on/off distinction; the named player may be the one entering OR leaving. We infer
// direction from on-field state seeded by boxscore starters, then reconcile with boxscore minutes.
import type { Game, GameEvent, LineupPlayer, OppLineupPlayer, TeamCode } from '@/lib/types';
import { HALF_SECS, assembleGame, fmtClock, looksLikeFlorida, mapPos, pairSubs, periodStart, tierFor, titleCase, toNum } from './ncaaShared';

// ---------------------------------------------------------------- response shapes (subset)

export interface NcaaTeam {
  isHome: boolean;
  teamId?: string;
  seoname?: string;
  nameShort?: string;
  nameFull?: string;
  score?: number | null;
  conferenceSeo?: string;
}
export interface NcaaContest {
  contestId: number | string;
  gameState: string; // P pre, I live, F final
  statusCodeDisplay?: string;
  currentPeriod?: string;
  contestClock?: string;
  startDate: string; // MM/DD/YYYY
  startTime?: string;
  startTimeEpoch?: number;
  teams: NcaaTeam[];
}
export interface NcaaContestsResponse {
  data?: { contests?: NcaaContest[] };
}
export interface NcaaPlay {
  playText: string;
  clock: string;
  homeScore?: number | string | null;
  visitorScore?: number | string | null;
}
export interface NcaaPbpResponse {
  data?: {
    playbyplay?: {
      contestId: number | string;
      status?: string;
      period?: number;
      teams: NcaaTeam[];
      periods: { periodNumber: number; periodDisplay?: string; playbyplayStats: { clock: string; teamId: number | string; plays: NcaaPlay[] }[] }[];
    } | null;
  };
}
export interface NcaaPlayerStat {
  firstName: string;
  lastName: string;
  position?: string | null;
  number?: number | string | null;
  minutesPlayed?: string | null;
  goals?: string | null;
  assists?: string | null;
  shots?: string | null;
  shotsOnGoal?: string | null;
  starter?: boolean | null;
  participated?: boolean | null;
}
export interface NcaaBoxResponse {
  data?: {
    boxscore?: {
      contestId: number | string;
      status?: string;
      period?: string;
      teams: NcaaTeam[];
      teamBoxscore: { teamId: number | string; playerStats: NcaaPlayerStat[]; teamStats?: { goals?: string | null } | null }[];
    } | null;
  };
}

// ---------------------------------------------------------------- contests list

export interface FloridaContest {
  contestId: string;
  date: string; // YYYY-MM-DD
  startTime?: string;
  startTimeEpoch?: number;
  gameState: string;
  live: boolean;
  final: boolean;
  status?: string;
  period?: string;
  clock?: string;
  opp: string;
  oppConf?: string;
  venue: 'Home' | 'Away';
  ufScore: number | null;
  oppScore: number | null;
}

export function isUfTeam(t: NcaaTeam | undefined): boolean {
  if (!t) return false;
  if (t.seoname) return t.seoname === 'florida';
  return looksLikeFlorida(t.nameShort || t.nameFull);
}

export function mdyToIso(mdy: string): string {
  const m = mdy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : mdy;
}

export function floridaContests(json: NcaaContestsResponse): FloridaContest[] {
  const out: FloridaContest[] = [];
  for (const c of json.data?.contests || []) {
    const uf = c.teams.find(isUfTeam);
    const opp = c.teams.find((t) => t !== uf);
    if (!uf || !opp) continue;
    out.push({
      contestId: String(c.contestId),
      date: mdyToIso(c.startDate),
      startTime: c.startTime,
      startTimeEpoch: c.startTimeEpoch,
      gameState: c.gameState,
      live: c.gameState === 'I',
      final: c.gameState === 'F',
      status: c.statusCodeDisplay,
      period: c.currentPeriod,
      clock: c.contestClock,
      opp: opp.nameShort || opp.nameFull || 'Opponent',
      oppConf: opp.conferenceSeo,
      venue: uf.isHome ? 'Home' : 'Away',
      ufScore: uf.score ?? null,
      oppScore: opp.score ?? null,
    });
  }
  return out;
}

// ---------------------------------------------------------------- PBP + box → Game

export interface NcaaToGameOpts {
  date?: string; // YYYY-MM-DD (PBP has no date; take it from the contests list)
  venue?: Game['venue'];
  tier?: string;
  conf?: string;
  oppConf?: string;
  stage?: string;
}

export interface NcaaConfidence {
  level: 'high' | 'medium' | 'low';
  subLines: number;
  subEvents: number;
  unpairedMoments: number;
  /** Sub sides the feed omitted that were filled in from box-score minutes. */
  inferredSides: number;
  unknownNames: number;
  playersChecked: number;
  minutesMismatches: number;
  /** Max absolute minutes gap across Florida players (box vs inferred). */
  maxMinutesGap: number;
  live: boolean;
}

export interface NcaaToGameResult {
  game: Game;
  warnings: string[];
  confidence: NcaaConfidence;
}

interface BoxPlayer extends LineupPlayer {
  starter: boolean;
  firstRaw: string;
}

function boxPlayers(stats: NcaaPlayerStat[]): BoxPlayer[] {
  return stats.map((p) => {
    const bp: BoxPlayer = { name: titleCase(p.lastName || ''), starter: !!p.starter, firstRaw: p.firstName || '' };
    if (p.firstName) bp.first = titleCase(p.firstName);
    if (p.number !== null && p.number !== undefined && p.number !== '') bp.num = String(p.number);
    const pos = mapPos(p.position);
    if (pos) bp.pos = pos;
    const min = toNum(p.minutesPlayed);
    if (min !== undefined) bp.min = Math.round(min * 10) / 10;
    const sh = toNum(p.shots);
    const g = toNum(p.goals);
    const a = toNum(p.assists);
    if (sh !== undefined) bp.sh = sh;
    if (g !== undefined) bp.g = g;
    if (a !== undefined) bp.a = a;
    return bp;
  });
}

/** Full name first, then last name + first initial, then last name alone (if unique). */
function nameMatcher(players: BoxPlayer[]) {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  return (full: string): string | null => {
    const s = full.replace(/\s+/g, ' ').trim();
    const exact = players.find((p) => n(p.firstRaw + p.name) === n(s));
    if (exact) return exact.name;
    const parts = s.split(' ');
    for (let i = 1; i < parts.length; i++) {
      const last = n(parts.slice(i).join(''));
      const initial = n(parts[0]).slice(0, 1);
      const hits = players.filter((p) => n(p.name) === last);
      const byInit = hits.filter((p) => n(p.firstRaw).startsWith(initial));
      if (byInit.length === 1) return byInit[0].name;
      if (hits.length === 1) return hits[0].name;
    }
    return null;
  };
}

/** "16:31:03" (mm:ss:ff, cumulative match clock) → seconds. Also accepts "mm:ss". */
export function ncaaClockSecs(clock: string): number | null {
  const p = clock.split(':').map((x) => parseInt(x, 10));
  if (p.length < 2 || p.some((x) => Number.isNaN(x))) return null;
  return p[0] * 60 + p[1];
}

function eventTime(period: number, raw: number): { half: number; t: number } {
  const start = periodStart(period);
  let t = raw < start ? start + raw : raw; // tolerate per-period clocks
  if (period === 1 && t > HALF_SECS) t = HALF_SECS; // stoppage time folds onto 45:00
  if (period >= 2 && t < start) t = start;
  return { half: period, t };
}

const byPlayer = (t: string) => {
  const m = t.match(/\bby\s+(.+?)\s*$/i);
  const name = m ? m[1].trim() : '';
  return name && !/^team$/i.test(name) ? name : '';
};

export function ncaaToGame(pbpJson: NcaaPbpResponse, boxJson: NcaaBoxResponse, opts: NcaaToGameOpts = {}): NcaaToGameResult {
  const warnings: string[] = [];
  const pbp = pbpJson.data?.playbyplay;
  const box = boxJson.data?.boxscore;
  const teams = box?.teams || pbp?.teams || [];
  const uf = teams.find(isUfTeam);
  const opp = teams.find((t) => t !== uf);
  if (!uf || !opp) throw new Error('ncaaToGame: Florida is not in this contest');
  const ufId = String(uf.teamId);
  const teamOf = (id: number | string): TeamCode => (String(id) === ufId ? 'UF' : 'OPP');

  const ufBoxRaw = box?.teamBoxscore.find((t) => String(t.teamId) === ufId);
  const oppBoxRaw = box?.teamBoxscore.find((t) => String(t.teamId) !== ufId);
  const ufPlayers = boxPlayers(ufBoxRaw?.playerStats || []);
  const oppPlayers = boxPlayers(oppBoxRaw?.playerStats || []);
  if (!ufPlayers.length) warnings.push('Box score has no Florida players yet (lineups usually post near kickoff).');
  const match: Record<TeamCode, (s: string) => string | null> = { UF: nameMatcher(ufPlayers), OPP: nameMatcher(oppPlayers) };


  const events: GameEvent[] = [];
  let subLines = 0;
  let unpairedMoments = 0;
  let inferredSides = 0;
  const live = !!box && box.status !== 'F' && !/final/i.test(box.period || '');
  let unknownNames = 0;
  const unknownSeen = new Set<string>();
  const resolve = (team: TeamCode, raw: string) => {
    const hit = match[team](raw);
    if (hit) return hit;
    const parts = raw.trim().split(/\s+/);
    const fallback = titleCase(parts[parts.length - 1] || raw);
    if (!unknownSeen.has(team + raw)) {
      unknownSeen.add(team + raw);
      unknownNames++;
      warnings.push(`${team === 'UF' ? 'Florida' : 'Opponent'} player "${raw}" not in box score; using "${fallback}".`);
    }
    return fallback;
  };

  // Flatten plays in feed order.
  type Flat = { half: number; t: number; team: TeamCode; text: string };
  const flat: Flat[] = [];
  for (const per of pbp?.periods || []) {
    for (const grp of per.playbyplayStats) {
      for (const pl of grp.plays) {
        const raw = ncaaClockSecs(pl.clock || grp.clock);
        if (raw === null) continue;
        const { half: h, t } = eventTime(per.periodNumber, raw);
        // Halftime subs (logged at 45:00 at the end of 1H or start of 2H) belong to 2H.
        const half = /^sub\b/i.test(pl.playText) && t === HALF_SECS ? 2 : h;
        flat.push({ half, t, team: teamOf(grp.teamId), text: pl.playText.replace(/\s+/g, ' ').trim() });
      }
    }
  }

  // Split plays into sub "moments" (same team + same t) and other events.
  type Named = { name: string; dir: 'in' | 'out' | '' };
  type Moment = { half: number; t: number; team: TeamCode; named: Named[] };
  const moments: Moment[] = [];
  const momentByKey = new Map<string, Moment>();
  const appearances = new Map<string, number[]>();
  for (const f of flat) {
    const m = f.text.match(/^sub(?:stitution)?\s*(in|on|out|off)?\b\s*:?\s*(.+)$/i);
    if (m) {
      subLines++;
      const name = resolve(f.team, m[2]);
      const d = (m[1] || '').toLowerCase();
      const key = `${f.team}|${f.t}`;
      let mo = momentByKey.get(key);
      if (!mo) {
        mo = { half: f.half, t: f.t, team: f.team, named: [] };
        momentByKey.set(key, mo);
        moments.push(mo);
      }
      // ncaa.com writes "Sub in" for every line, so in/on is not trusted; explicit out/off is.
      mo.named.push({ name, dir: d === 'out' || d === 'off' ? 'out' : '' });
      const ak = `${f.team}|${name}`;
      appearances.set(ak, [...(appearances.get(ak) || []), f.t]);
      continue;
    }
    const ev = otherEvent(f, resolve);
    if (ev) events.push(ev);
  }
  moments.sort((a, b) => a.t - b.t);

  const endT = Math.max(2 * HALF_SECS, ...flat.map((f) => f.t));
  const boxMin: Record<TeamCode, Map<string, number>> = { UF: new Map(), OPP: new Map() };
  for (const [team, ps] of [['UF', ufPlayers], ['OPP', oppPlayers]] as const) for (const p of ps) if (p.min !== undefined) boxMin[team].set(p.name, p.min * 60);
  const useMinutes = !live;
  const nextAppearance = (team: TeamCode, name: string, t: number) => (appearances.get(`${team}|${name}`) || []).find((x) => x > t) ?? null;
  const state: Record<TeamCode, { onSince: Map<string, number>; played: Map<string, number> }> = {
    UF: { onSince: new Map(ufPlayers.filter((p) => p.starter).map((p) => [p.name, 0])), played: new Map() },
    OPP: { onSince: new Map(oppPlayers.filter((p) => p.starter).map((p) => [p.name, 0])), played: new Map() },
  };

  for (const mo of moments) {
    const st = state[mo.team];
    const mins = boxMin[mo.team];
    const ins: string[] = [];
    const outs: string[] = [];
    for (const n of mo.named) {
      if (ins.includes(n.name) || outs.includes(n.name)) continue;
      (n.dir === 'out' || st.onSince.has(n.name) ? outs : ins).push(n.name);
    }
    const inferred: string[] = [];
    if (useMinutes && mins.size) {
      const played = (n: string) => st.played.get(n) || 0;
      // Missing OFF: pick the on-field player whose box minutes best fit leaving now.
      while (outs.length < ins.length) {
        let best: string | null = null;
        let bestScore = Infinity;
        for (const [n, since] of st.onSince) {
          if (outs.includes(n) || !mins.has(n)) continue;
          const back = nextAppearance(mo.team, n, mo.t);
          const total = played(n) + (mo.t - since) + (back !== null ? endT - back : 0);
          const score = Math.abs((mins.get(n) as number) - total);
          if (score < bestScore) [best, bestScore] = [n, score];
        }
        if (!best || bestScore > 180) break;
        outs.push(best);
        inferred.push(`${best} off`);
      }
      // Missing ON: pick the off-field player whose remaining box minutes best fit entering now.
      while (ins.length < outs.length) {
        let best: string | null = null;
        let bestScore = Infinity;
        for (const [n, m] of mins) {
          if (st.onSince.has(n) || ins.includes(n) || outs.includes(n) || m - played(n) < 30) continue;
          const leave = nextAppearance(mo.team, n, mo.t) ?? endT;
          const score = Math.abs(m - (played(n) + leave - mo.t));
          if (score < bestScore) [best, bestScore] = [n, score];
        }
        if (!best || bestScore > 180) break;
        ins.push(best);
        inferred.push(`${best} on`);
      }
    }
    for (const o of outs) {
      st.played.set(o, (st.played.get(o) || 0) + mo.t - (st.onSince.get(o) ?? mo.t));
      st.onSince.delete(o);
    }
    for (const n of ins) st.onSince.set(n, mo.t);
    if (inferred.length) {
      inferredSides += inferred.length;
      warnings.push(`${mo.team === 'UF' ? 'Florida' : 'Opponent'} subs at ${fmtClock(mo.t)}: feed named one side only; inferred ${inferred.join(', ')} from box-score minutes.`);
    }
    const before = warnings.length;
    events.push(...pairSubs(ins, outs, { half: mo.half, clock: fmtClock(mo.t), t: mo.t, team: mo.team }, warnings));
    if (warnings.length > before) unpairedMoments++;
  }

  const sumGoals = (ps: BoxPlayer[]) => ps.reduce((s, p) => s + (p.g || 0), 0);
  const teamGoals = (raw: typeof ufBoxRaw, ps: BoxPlayer[]) => toNum(raw?.teamStats?.goals) ?? (ps.length ? sumGoals(ps) : undefined);
  const strip = ({ starter: _s, firstRaw: _f, ...p }: BoxPlayer): LineupPlayer => ({ ...p, min: p.min === undefined ? undefined : Math.round(p.min) }); // eslint-disable-line @typescript-eslint/no-unused-vars
  const oppStrip = (p: BoxPlayer): OppLineupPlayer => ({ name: p.name, num: p.num, min: p.min === undefined ? undefined : Math.round(p.min) });
  const oppConf = opts.oppConf || opp.conferenceSeo;

  const game = assembleGame(
    {
      date: opts.date,
      opp: opp.nameShort || opp.nameFull || 'Opponent',
      venue: opts.venue || (uf.isHome ? 'Home' : 'Away'),
      starters: ufPlayers.filter((p) => p.starter).map(strip),
      bench: ufPlayers.filter((p) => !p.starter).map(strip),
      oppStarters: oppPlayers.filter((p) => p.starter).map(oppStrip),
      oppBench: oppPlayers.filter((p) => !p.starter).map(oppStrip),
      events,
      gf: live ? undefined : teamGoals(ufBoxRaw, ufPlayers),
      ga: live ? undefined : teamGoals(oppBoxRaw, oppPlayers),
      tier: opts.tier || tierFor(oppConf),
      conf: opts.conf ?? (oppConf ? (oppConf.toLowerCase() === 'sec' ? 'SEC' : 'Non-conf') : undefined),
      stage: opts.stage,
      source: 'ncaa',
    },
    warnings,
  );
  game.ncaaId = String(pbp?.contestId ?? box?.contestId ?? '');

  // Minutes reconciliation (final games only; live minutes are partial).
  const { checked, mismatches, maxGap } = live ? { checked: 0, mismatches: 0, maxGap: 0 } : reconcileMinutes(game, ufPlayers, warnings);
  const subEvents = events.filter((e) => e.type === 'SUB').length;
  let level: NcaaConfidence['level'] = 'high';
  if (mismatches > 0 || unpairedMoments > 0 || unknownNames > 0 || inferredSides > 0) level = 'medium';
  if (mismatches > 3 || unpairedMoments > 3 || (!live && checked === 0)) level = 'low';
  return {
    game,
    warnings,
    confidence: { level, subLines, subEvents, unpairedMoments, inferredSides, unknownNames, playersChecked: checked, minutesMismatches: mismatches, maxMinutesGap: Math.round(maxGap * 10) / 10, live },
  };
}

function otherEvent(f: { half: number; t: number; team: TeamCode; text: string }, resolve: (team: TeamCode, raw: string) => string): GameEvent | null {
  const base = { half: f.half, clock: fmtClock(f.t), t: f.t, team: f.team };
  const who = byPlayer(f.text);
  const player = who ? resolve(f.team, who) : undefined;
  const withPlayer = (ev: GameEvent) => {
    if (player) ev.player = player;
    return ev;
  };
  if (/^goal\b/i.test(f.text) && !/^goalkick/i.test(f.text)) {
    const ev = withPlayer({ ...base, type: 'GOAL' });
    if (/penalty|\bpk\b|penaltykick/i.test(f.text)) ev.pk = true;
    return ev;
  }
  if (/^owngoal/i.test(f.text)) return { ...base, type: 'GOAL' };
  if (/^shot\b/i.test(f.text)) {
    // goalmouth:<target> with no "out"/"blocked" means on frame.
    const sog = /goalmouth:(?!out)/i.test(f.text) && !/blocked|post|bar/i.test(f.text);
    return withPlayer({ ...base, type: 'SHOT', sog });
  }
  if (/^card\s*(yellow|red|secondyellow)/i.test(f.text)) {
    return withPlayer({ ...base, type: 'CARD', card: /red|secondyellow/i.test(f.text) ? 'red' : 'yellow' });
  }
  if (/^corner\s*\(taken\)/i.test(f.text)) return { ...base, type: 'CORNER' };
  if (/^offside/i.test(f.text)) return { ...base, type: 'OFFSIDE' };
  return null;
}

function reconcileMinutes(game: Game, players: BoxPlayer[], warnings: string[]) {
  const end = Math.max(2 * HALF_SECS, ...game.events.map((e) => e.t));
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
  let checked = 0;
  let mismatches = 0;
  let maxGap = 0;
  for (const p of players) {
    if (p.min === undefined) continue;
    checked++;
    const implied = (secs.get(p.name) || 0) / 60;
    const gap = Math.abs(implied - p.min);
    maxGap = Math.max(maxGap, gap);
    if (gap > 2) {
      mismatches++;
      warnings.push(`Minutes check: ${p.name} box score ${p.min}' vs ${implied.toFixed(1)}' inferred from subs.`);
    }
  }
  return { checked, mismatches, maxGap };
}

// ---------------------------------------------------------------- live refresh merge

/**
 * Merge a fresh ncaa.com parse into a game the user may have edited. Feed-owned fields (lineup,
 * events, score) come from `fresh`; manual fields (venue, tier, conf, stage, env, notes, location,
 * date, id) are kept from `prev`. The feed is append-only and re-sends every play on each refresh,
 * so any `prev` event absent from `fresh` is treated as a manual addition and preserved.
 * Pass `prevFresh` (the previous raw feed parse) so feed events that were corrected or re-inferred
 * upstream (e.g. a half-filled SUB completed once box minutes are final) are replaced, not duplicated.
 */
export function refreshLiveGame(prev: Game, fresh: Game, prevFresh?: Game): Game {
  const key = (e: GameEvent) => [e.type, e.team, e.t, e.on || '', e.off || '', e.player || ''].join('|');
  const freshKeys = new Set(fresh.events.map(key));
  const feedKeys = new Set(prevFresh?.events.map(key) ?? []);
  const manual = prev.events.filter((e) => !freshKeys.has(key(e)) && !feedKeys.has(key(e)));
  const events = [...fresh.events, ...manual].sort((a, b) => a.t - b.t);
  const merged: Game = {
    ...fresh,
    id: prev.id,
    date: prev.date || fresh.date,
    venue: prev.venue,
    tier: prev.tier || fresh.tier,
    events,
  };
  for (const k of ['conf', 'stage', 'env', 'notes', 'location', 'addedAt'] as const) {
    if (prev[k] !== undefined) (merged as unknown as Record<string, unknown>)[k] = prev[k];
  }
  return merged;
}
