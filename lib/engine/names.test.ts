import { describe, expect, it } from 'vitest';
import { buildNameIndex, formatPlayer, playerLabel } from './names';
import type { Game } from '@/lib/types';

const g = (date: string, p: { name: string; first?: string; num?: string }) =>
  ({ id: date, date, opp: 'X', venue: 'Home', gf: 0, ga: 0, result: 'T', tier: 'P4', lineup: { starters: [p], bench: [] }, events: [] }) as Game;

describe('player labels', () => {
  it('formats #num - First Last', () => expect(formatPlayer({ last: 'Jane', first: 'Mary', num: '19' })).toBe('#19 - Mary Jane'));
  it('falls back gracefully', () => {
    expect(formatPlayer({ last: 'Jane', first: 'Mary' })).toBe('Mary Jane');
    expect(formatPlayer({ last: 'Jane', num: '#7' })).toBe('#7 - Jane');
    expect(formatPlayer({ last: 'Jane' })).toBe('Jane');
  });
  it('uses latest lineup, roster overrides', () => {
    const idx = buildNameIndex([g('2026-09-01', { name: 'Jane', num: '9' }), g('2026-10-01', { name: 'Jane', first: 'Mary', num: '19' })], { Jane: { pos: 'MID', num: '20' } });
    expect(playerLabel('Jane', idx)).toBe('#20 - Mary Jane');
    expect(playerLabel('Unknown', idx)).toBe('Unknown');
  });
});
