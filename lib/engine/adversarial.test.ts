// Adversarial edge cases for the spell engine (synthetic fixtures only).
import { describe, expect, it } from 'vitest';
import type { Game, GameEvent } from '@/lib/types';
import { fullD, halfD } from './core';
import { teamStats } from './aggregates';
import { BENCH, STARTERS, ev, sub } from './__fixtures__/games';

const mk = (events: GameEvent[]): Game => ({
  id: 'adv', date: '2026-09-20', opp: 'Edgecase', venue: 'Home', gf: 0, ga: 0, result: 'T', tier: 'P4', conf: 'Non-conf',
  lineup: { starters: STARTERS(), bench: BENCH() }, events,
});
const total = (g: Game) => Object.values(fullD(g).mins).reduce((a, b) => a + b, 0);
const onAt = (g: Game, m: number) => Object.values(fullD(g).spells).filter((sp) => sp.some(([a, b]) => a <= m && b > m)).length;

describe('adversarial', () => {
  it('zero subs: 11 full 90s, 990 total minutes, empty half sub lists', () => {
    const g = mk([]);
    const F = fullD(g);
    expect(Object.keys(F.spells)).toHaveLength(11);
    expect(total(g)).toBeCloseTo(990, 6);
    expect(F.htSubs).toEqual([]);
    expect(F.inplay2).toEqual([]);
    for (const h of [1, 2] as const) {
      const d = halfD(g, h);
      expect(d.subs).toEqual([]);
      expect(d.first).toBeNull();
      expect(d.full).toHaveLength(11);
      expect(Object.values(d.minH).reduce((a, b) => a + b, 0)).toBeCloseTo(495, 6);
    }
    expect(teamStats([g], 1).perGame).toBe(0);
  });

  it('sub logged twice at the same second is idempotent for minutes', () => {
    const once = mk([sub(1, '20:00', 'Kapok', 'Alder')]);
    const twice = mk([sub(1, '20:00', 'Kapok', 'Alder'), sub(1, '20:00', 'Kapok', 'Alder')]);
    expect(fullD(twice).spells).toEqual(fullD(once).spells);
    expect(total(twice)).toBeCloseTo(990, 6);
    expect(fullD(twice).warnings.length).toBe(1);
  });

  it('off, on, off again in the 2nd half: three spells, 11 on the field throughout', () => {
    const g = mk([
      sub(1, '20:00', 'Kapok', 'Alder'),
      sub(2, '55:00', 'Alder', 'Kapok'),
      sub(2, '70:00', 'Kapok', 'Alder'),
      sub(2, '80:00', 'Alder', 'Kapok'),
      sub(2, '85:00', 'Larch', 'Alder'),
    ]);
    const F = fullD(g);
    expect(F.spells.Alder).toEqual([[0, 20], [55, 70], [80, 85]]);
    expect(F.spells.Kapok).toEqual([[20, 55], [70, 80]]);
    expect(F.spells.Larch).toEqual([[85, 90]]);
    expect(total(g)).toBeCloseTo(990, 6);
    for (const m of [0, 19.9, 20, 54.9, 55, 70, 80, 85, 89.9]) expect(onAt(g, m)).toBe(11);
    const d2 = halfD(g, 2);
    expect(d2.starters).toContain('Kapok');
    expect(d2.starters).not.toContain('Alder');
    expect(d2.subs.map((s) => s.starterOff)).toEqual([true, false, false, false]);
    expect(d2.minH.Alder).toBeCloseTo(20, 6);
  });

  it('1st-half sub at 44:59 is in-play; a sub at 45:00 is a halftime change', () => {
    const g = mk([sub(1, '44:59', 'Kapok', 'Alder'), sub(2, '45:00', 'Larch', 'Birch')]);
    const F = fullD(g);
    expect(F.htSubs.map((s) => s.on)).toEqual(['Larch']);
    const d1 = halfD(g, 1), d2 = halfD(g, 2);
    expect(d1.subs.map((s) => s.on)).toEqual(['Kapok']);
    expect(d1.first).toBeCloseTo(44 + 59 / 60, 6);
    expect(d2.subs).toEqual([]);
    expect(d2.starters).toEqual(expect.arrayContaining(['Kapok', 'Larch']));
    expect(d2.starters).not.toContain('Birch');
    expect(d1.minH.Birch).toBeCloseTo(45, 6);
    expect(d1.minH.Kapok).toBeCloseTo(1 / 60, 6);
    expect(total(g)).toBeCloseTo(990, 6);
  });

  it('game state at each sub (goal at the same second counts after the sub)', () => {
    const g = mk([
      ev(1, '10:00', 'GOAL', { player: 'Fir' }),
      sub(1, '15:00', 'Kapok', 'Alder'),
      ev(2, '50:00', 'GOAL', { team: 'OPP', player: 'Opp9' }),
      ev(2, '60:00', 'GOAL', { team: 'OPP', player: 'Opp9' }),
      sub(2, '60:00', 'Larch', 'Birch'),
      sub(2, '61:00', 'Maple', 'Cedar'),
      sub(2, '55:00', 'Nutmeg', 'Elm'), // logged out of order
    ]);
    const s = fullD(g).subs.map((x) => [x.on, x.state]);
    expect(s).toEqual([['Kapok', 'Winning'], ['Nutmeg', 'Level'], ['Larch', 'Level'], ['Maple', 'Losing']]);
  });

  it('red card plays a man down: total minutes reflect 10 players', () => {
    const g = mk([ev(2, '60:00', 'CARD', { card: 'red', player: 'Elm' }), sub(2, '70:00', 'Kapok', 'Fir')]);
    expect(fullD(g).spells.Elm).toEqual([[0, 60]]);
    expect(total(g)).toBeCloseTo(990 - 30, 6);
    expect(halfD(g, 2).full).not.toContain('Elm');
  });

  it('cache is keyed by object identity (a replaced game object recomputes)', () => {
    const g = mk([]);
    const a = fullD(g);
    expect(fullD(g)).toBe(a);
    const g2 = { ...g, events: [sub(1, '20:00', 'Kapok', 'Alder')] };
    expect(fullD(g2).spells.Kapok).toEqual([[20, 90]]);
    expect(Object.keys(g)).not.toContain('_f');
  });
});
