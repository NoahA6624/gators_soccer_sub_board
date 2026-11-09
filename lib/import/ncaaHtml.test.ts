import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseNcaaHtml } from './ncaaHtml';

const fx = (f: string) => fs.readFileSync(path.join(__dirname, '__fixtures__', f), 'utf8');

describe('parseNcaaHtml: separate PBP + box score (Florida home column, count-up clocks)', () => {
  const { game, warnings } = parseNcaaHtml(fx('ncaaHtml-pbp-a.html'), { boxHtml: fx('ncaaHtml-box-a.html'), tier: 'P4' });

  it('builds lineup from GS column with numbers/positions', () => {
    expect(game.lineup.starters).toHaveLength(11);
    expect(game.lineup.bench.map((p) => p.name)).toEqual(['Lima', 'Mike', 'November', 'Oscar']);
    expect(game.lineup.starters[0]).toMatchObject({ name: 'Alpha', first: 'Ann', num: '1', pos: 'GK', min: 90 });
    expect(game.lineup.starters.find((p) => p.name === 'Juliet')).toMatchObject({ g: 1, sh: 2 });
  });

  it('identifies opponent, venue, score, date', () => {
    expect(game.opp).toBe('Rival U');
    expect(game.venue).toBe('Home');
    expect(game.date).toBe('2026-11-08');
    expect(game.id).toBe('2026-11-08-rival-u');
    expect([game.gf, game.ga, game.result]).toEqual([2, 0, 'W']);
    expect(game.ht).toEqual({ uf: 1, opp: 0 });
    expect(game.source).toBe('ncaa');
  });

  it('pairs simultaneous subs in order and offsets 2H clock', () => {
    const subs = game.events.filter((e) => e.type === 'SUB' && e.team === 'UF');
    expect(subs).toEqual([
      { half: 2, clock: '45:00', t: 2700, team: 'UF', type: 'SUB', on: 'Lima', off: 'Hotel' },
      { half: 2, clock: '60:00', t: 3600, team: 'UF', type: 'SUB', on: 'Mike', off: 'Foxtrot' },
      { half: 2, clock: '60:00', t: 3600, team: 'UF', type: 'SUB', on: 'November', off: 'India' },
    ]);
    const oppSub = game.events.find((e) => e.type === 'SUB' && e.team === 'OPP');
    expect(oppSub).toMatchObject({ on: 'Oboe', off: 'Romeo', t: 3930 });
  });

  it('parses goals, shots, cards, corners', () => {
    const goals = game.events.filter((e) => e.type === 'GOAL');
    expect(goals.map((g) => [g.player, g.t, g.team])).toEqual([
      ['Juliet', 1200, 'UF'],
      ['Mike', 4200, 'UF'],
    ]);
    expect(game.events.find((e) => e.type === 'SHOT' && e.team === 'UF')).toMatchObject({ player: 'Juliet', sog: true });
    expect(game.events.find((e) => e.type === 'SHOT' && e.team === 'OPP')).toMatchObject({ player: 'Papa', sog: false });
    expect(game.events.find((e) => e.type === 'CARD')).toMatchObject({ player: 'Sierra', card: 'yellow', team: 'OPP' });
    expect(game.events.filter((e) => e.type === 'CORNER')).toHaveLength(1);
  });

  it('minutes reconcile with box score (no minutes warnings)', () => {
    expect(warnings.filter((w) => w.startsWith('Minutes check'))).toEqual([]);
    expect(warnings.some((w) => /subs at/.test(w))).toBe(false);
  });
});

describe('parseNcaaHtml: combined page (Florida first column, countdown clock, prose subs, asterisk starters)', () => {
  const { game, warnings } = parseNcaaHtml(fx('ncaaHtml-combined-b.html'), { date: '2026-10-01', venue: 'Away', tier: 'Non-P4' });

  it('detects Florida column despite ranking/record decorations', () => {
    expect(game.opp).toBe('Rival U');
    expect(game.lineup.starters).toHaveLength(11);
    expect(game.lineup.starters.map((p) => p.name)).toContain('Hotel');
    expect(game.lineup.bench.map((p) => p.name)).toContain('Lima');
  });

  it('converts countdown clocks to elapsed time', () => {
    expect(warnings.some((w) => /counts down/.test(w))).toBe(true);
    const subs = game.events.filter((e) => e.type === 'SUB');
    expect(subs[0]).toMatchObject({ half: 1, t: 900, clock: '15:00', on: 'Lima', off: 'Hotel' });
    expect(subs[1]).toMatchObject({ half: 2, t: 3900, on: 'Mike', off: 'India' });
  });

  it('keeps unpaired sub-ins as entries and warns', () => {
    const sub = game.events.find((e) => e.type === 'SUB' && e.on === 'November');
    expect(sub).toMatchObject({ t: 3900 });
    expect(sub?.off).toBeUndefined();
    expect(warnings.some((w) => /2 in .* vs 1 out/.test(w))).toBe(true);
  });

  it('scores from PBP, PK goal flagged, opponent goal resolved', () => {
    expect([game.gf, game.ga, game.result]).toEqual([1, 1, 'T']);
    expect(game.events.find((e) => e.type === 'GOAL' && e.team === 'UF')).toMatchObject({ player: 'Juliet', pk: true, t: 5100 });
    expect(game.events.find((e) => e.type === 'GOAL' && e.team === 'OPP')).toMatchObject({ player: 'Romeo', t: 2100 });
    // Fixture deliberately lists Foxtrot at 60' with no sub: the minutes check must flag it.
    expect(warnings.filter((w) => w.startsWith('Minutes check'))).toEqual([expect.stringContaining('Foxtrot box score 60')]);
  });
});

describe('parseNcaaHtml: degraded input', () => {
  it('returns warnings, not throws, on unrelated HTML', () => {
    const { game, warnings } = parseNcaaHtml('<html><body><p>nothing here</p></body></html>');
    expect(game.events).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('box score only still gives a lineup', () => {
    const { game, warnings } = parseNcaaHtml(fx('ncaaHtml-box-a.html'));
    expect(game.lineup.starters).toHaveLength(11);
    expect(game.opp).toBe('Rival U');
    expect(warnings.some((w) => /No play-by-play/.test(w))).toBe(true);
  });
});
