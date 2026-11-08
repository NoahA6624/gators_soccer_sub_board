import { describe, expect, it } from 'vitest';
import { ppD, ppG, sortRows, wkInfo, wkKey, type MinRow } from './helpers';
import type { Game } from '@/lib/types';

const G = (id: string, date: string, venue: 'Home' | 'Away' = 'Home'): Game => ({
  id, date, opp: 'Test U', venue, gf: 1, ga: 0, result: 'W', tier: 'P4', lineup: { starters: [], bench: [] }, events: [],
});
const R = (p: string, full: number, num = ''): MinRow => ({
  p, first: '', num, pos: '', role: 'Start', m1: 0, m2: 0, full, x1: 0, x2: 0, xf: full, spells: '', firstOn: 0,
});

describe('games helpers', () => {
  it('formats match labels', () => {
    expect(ppD(G('a', '2025-09-04'))).toBe('09/04');
    expect(ppG(G('a', '2025-09-04', 'Away'))).toBe('at Test U');
  });
  it('groups Monday-start weeks', () => {
    expect(wkKey('2025-09-07')).toBe('2025-09-01'); // Sunday -> previous Monday
    const w = wkInfo([G('a', '2025-09-04'), G('b', '2025-09-07'), G('c', '2025-09-12')]);
    expect(w.a).toEqual({ n: 2, i: 1 });
    expect(w.b).toEqual({ n: 2, i: 2 });
    expect(w.c).toEqual({ n: 1, i: 1 });
  });
  it('sorts minutes rows stably', () => {
    const rows = [R('Aa', 45, '9'), R('Bb', 90, '2'), R('Cc', 45, '1')];
    expect(sortRows(rows, 'full', -1).map((r) => r.p)).toEqual(['Bb', 'Aa', 'Cc']);
    expect(sortRows(rows, 'num', 1).map((r) => r.p)).toEqual(['Cc', 'Bb', 'Aa']);
    expect(sortRows(rows, 'order', 1)).toBe(rows);
  });
});
