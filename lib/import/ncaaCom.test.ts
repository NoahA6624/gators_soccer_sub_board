import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { floridaContests, ncaaClockSecs, ncaaToGame, refreshLiveGame } from './ncaaCom';
import type { NcaaBoxResponse, NcaaContestsResponse, NcaaPbpResponse } from './ncaaCom';

const fx = JSON.parse(fs.readFileSync(path.join(__dirname, '__fixtures__', 'ncaaCom-synthetic.json'), 'utf8')) as {
  contests: NcaaContestsResponse;
  pbp: NcaaPbpResponse;
  box: NcaaBoxResponse;
};

describe('floridaContests', () => {
  it('lists only University of Florida games', () => {
    const list = floridaContests(fx.contests);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ contestId: '1000001', date: '2026-11-08', opp: 'Rival U', venue: 'Away', final: true, live: false, ufScore: 1, oppScore: 1, oppConf: 'sec' });
  });
});

describe('ncaaClockSecs', () => {
  it('reads mm:ss:ff cumulative clocks', () => {
    expect(ncaaClockSecs('16:31:03')).toBe(991);
    expect(ncaaClockSecs('45:00:00')).toBe(2700);
    expect(ncaaClockSecs('bad')).toBeNull();
  });
});

describe('ncaaToGame', () => {
  const { game, warnings, confidence } = ncaaToGame(fx.pbp, fx.box, { date: '2026-11-08' });

  it('maps lineup from boxscore', () => {
    expect(game.lineup.starters).toHaveLength(11);
    expect(game.lineup.starters[0]).toEqual({ name: 'Alpha', first: 'Ann', num: '1', pos: 'GK', min: 90, sh: 0, g: 0, a: 0 });
    expect(game.lineup.bench.map((p) => p.name)).toEqual(['Lima', 'Mike', 'November']);
    expect(game.oppLineup?.starters).toHaveLength(11);
  });

  it('game meta', () => {
    expect(game).toMatchObject({ id: '2026-11-08-rival-u', opp: 'Rival U', venue: 'Away', gf: 1, ga: 1, result: 'T', source: 'ncaa', ncaaId: '1000001' });
    expect(game.ht).toEqual({ uf: 1, opp: 0 });
    expect(game.tier).toBe(''); // boxscore has no conference; caller passes oppConf from contests list
    expect(ncaaToGame(fx.pbp, fx.box, { oppConf: 'sec' }).game).toMatchObject({ tier: 'P4', conf: 'SEC' });
  });

  it('infers sub direction from on-field state; halftime subs in half 2 at 2700', () => {
    const subs = game.events.filter((e) => e.type === 'SUB' && e.team === 'UF');
    expect(subs.map((s) => [s.half, s.t, s.on, s.off])).toEqual([
      [2, 2700, 'Lima', 'Hotel'],
      [2, 3612, 'Mike', 'Foxtrot'],
      [2, 4500, 'November', 'India'], // feed named only November; India inferred from box minutes
    ]);
    expect(warnings.some((w) => /inferred India off/.test(w))).toBe(true);
  });

  it('other events', () => {
    expect(game.events.find((e) => e.type === 'GOAL' && e.team === 'UF')).toMatchObject({ player: 'Juliet', t: 1200, half: 1 });
    expect(game.events.find((e) => e.type === 'GOAL' && e.team === 'OPP')).toMatchObject({ player: 'Romeo', t: 4200 });
    expect(game.events.find((e) => e.type === 'SHOT' && e.player === 'Juliet')).toMatchObject({ sog: true });
    expect(game.events.find((e) => e.type === 'SHOT' && e.player === 'Kilo')).toMatchObject({ sog: false });
    expect(game.events.find((e) => e.type === 'CARD')).toMatchObject({ player: 'Sierra', card: 'yellow', team: 'OPP' });
    expect(game.events.filter((e) => e.type === 'CORNER')).toHaveLength(1);
  });

  it('confidence + minutes reconciliation', () => {
    expect(warnings.filter((w) => w.startsWith('Minutes check'))).toEqual([]);
    expect(confidence).toMatchObject({ level: 'medium', inferredSides: 1, minutesMismatches: 0, unknownNames: 0, live: false });
  });

  it('flags minute mismatches', () => {
    const box = JSON.parse(JSON.stringify(fx.box)) as NcaaBoxResponse;
    box.data!.boxscore!.teamBoxscore[0].playerStats.find((p) => p.lastName === 'MIKE')!.minutesPlayed = '10';
    const r = ncaaToGame(fx.pbp, box, {});
    expect(r.warnings.some((w) => /Minutes check: Mike/.test(w))).toBe(true);
    expect(r.confidence.minutesMismatches).toBeGreaterThan(0);
  });

  it('throws when Florida is not in the contest', () => {
    const box = JSON.parse(JSON.stringify(fx.box)) as NcaaBoxResponse;
    box.data!.boxscore!.teams[0].seoname = 'somewhere';
    expect(() => ncaaToGame({ data: {} }, box)).toThrow(/Florida/);
  });
});

describe('refreshLiveGame', () => {
  it('takes feed events/lineup, keeps manual fields and hand-added events', () => {
    const { game: fresh } = ncaaToGame(fx.pbp, fx.box, { date: '2026-11-08' });
    const prev = {
      ...fresh,
      venue: 'Neutral' as const,
      tier: 'P4',
      notes: 'rain delay',
      env: { tempF: 70 },
      events: [...fresh.events.slice(0, 2), { half: 1, clock: '05:00', t: 300, type: 'FOUL' as const, team: 'UF' as const }],
    };
    const merged = refreshLiveGame(prev, fresh);
    expect(merged.venue).toBe('Neutral');
    expect(merged.tier).toBe('P4');
    expect(merged.notes).toBe('rain delay');
    expect(merged.env).toEqual({ tempF: 70 });
    expect(merged.events).toHaveLength(fresh.events.length + 1);
    expect(merged.events.some((e) => e.type === 'FOUL')).toBe(true);
  });
});
