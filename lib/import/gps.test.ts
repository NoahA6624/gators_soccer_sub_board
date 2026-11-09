import { describe, it, expect } from 'vitest';
import { matchGpsRows, parseGpsCsv } from './index';
import { sampleGame } from './__fixtures__/synthetic';
import type { Game } from '@/lib/types';

const game: Game = { ...sampleGame, lineup: { starters: [{ name: 'Alpha' }, { name: 'Bravo' }, { name: 'Smith' }], bench: [{ name: 'Jones' }] } };
const csv = [
  'Player Name,Total Distance,High Speed Running (m),Sprint Distance,Accelerations,Decelerations',
  'alpha,5000,300,50,10,12',
  'Bea Bravo,4800,280,,5,',
  '"Smith, Sam",4000,200,40,3,4',
  'Smith Jones (trial),3000,100,10,1,1',
  'Nobody Here,1,1,1,1,1',
].join('\n');

describe('GPS', () => {
  it('detects columns from headers', () => {
    expect(parseGpsCsv(csv).map).toEqual({ player: 0, dist: 1, hsr: 2, sprint: 3, acc: 4, dec: 5 });
  });
  it('matches exact, "First Last", "Last, First"; ambiguous token match stays unmatched', () => {
    const { rows, unmatched } = matchGpsRows(parseGpsCsv(csv), game, 1);
    expect(rows).toEqual([
      { player: 'Alpha', half: 1, dist: 5000, hsr: 300, sprint: 50, acc: 22 },
      { player: 'Bravo', half: 1, dist: 4800, hsr: 280, acc: 5 },
      { player: 'Smith', half: 1, dist: 4000, hsr: 200, sprint: 40, acc: 7 },
    ]);
    expect(unmatched).toEqual(['Smith Jones (trial)', 'Nobody Here']);
  });
  it('overrides win', () => {
    const { rows, unmatched } = matchGpsRows(parseGpsCsv(csv), game, 2, { 'Smith Jones (trial)': 'Jones', alpha: 'Bravo' });
    expect(rows.find((r) => r.dist === 3000)?.player).toBe('Jones');
    expect(rows.find((r) => r.dist === 5000)?.player).toBe('Bravo');
    expect(unmatched).toEqual(['Nobody Here']);
  });
});
