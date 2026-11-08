import { describe, it, expect } from 'vitest';
import { detectFormat, itemsToLines, parseGame, venueFor } from './pdfParse';
import { formatBPage } from './__fixtures__/synthetic';

describe('pdfParse Format B', () => {
  const pages = [formatBPage()];
  it('sniffs Format B', () => expect(detectFormat(itemsToLines(pages))).toBe('B'));
  const g = parseGame(pages);
  it('reads header, venue, kickoff', () => {
    expect([g.date, g.opp, g.location, g.venue, g.id]).toEqual(['2025-09-04', 'Fake State', 'Orlando, Fla.', 'Away', '2025-09-04-fake-state']);
    expect(g.env?.kickoff).toBe('19:00');
  });
  it('reads lineups', () => {
    expect(g.lineup.starters.map((p) => [p.name, p.first, p.num, p.pos, p.min])).toEqual([['Alpha', 'Ann', '1', 'GK', 90], ['Bravo', 'Bea', '7', 'MID', 50]]);
    expect(g.lineup.bench.map((p) => [p.name, p.first, p.num])).toEqual([['Delta', 'Dee', '22']]);
    expect(g.oppLineup.starters.map((p) => p.name)).toEqual(['Zed Zulu', 'Yara Yankee']);
  });
  it('one goal = exactly one GOAL and no SHOT (shots include goals)', () => {
    expect(g.events.filter((e) => e.clock === '20:00').map((e) => e.type)).toEqual(['GOAL']);
    // "Shot … GOAL" with no separate GOAL line becomes the GOAL
    expect(g.events.filter((e) => e.clock === '88:00')).toEqual([{ half: 2, clock: '88:00', t: 5280, type: 'GOAL', team: 'UF', player: 'Delta' }]);
    expect(g.events.filter((e) => e.type === 'SHOT')).toEqual([{ half: 1, clock: '12:30', t: 750, type: 'SHOT', team: 'UF', player: 'Bravo', sog: true }]);
  });
  it('scores, halves, other events', () => {
    expect([g.gf, g.ga, g.result, g.ht]).toEqual([2, 1, 'W', { uf: 1, opp: 0 }]);
    expect(g.events.find((e) => e.type === 'SUB')).toMatchObject({ half: 2, team: 'UF', on: 'Delta', off: 'Bravo' });
    expect(g.events.find((e) => e.pk)).toMatchObject({ type: 'GOAL', team: 'OPP', player: 'Yankee' });
    expect(g.events.find((e) => e.type === 'CARD')).toMatchObject({ team: 'OPP', card: 'yellow', player: 'Zulu' });
    expect(g.events.find((e) => e.type === 'CORNER')).toMatchObject({ team: 'OPP' });
  });
});

describe('venueFor', () => {
  it('Home / Away / Neutral', () => {
    expect(venueFor('Gainesville, Fla.', 'Georgia')).toBe('Home');
    expect(venueFor('Athens, Ga.', 'Georgia')).toBe('Away');
    expect(venueFor('Orlando, Fla.', 'Georgia')).toBe('Neutral');
    expect(venueFor('Somewhere', 'Unknown College')).toBe('Away');
  });
});
