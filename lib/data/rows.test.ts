import { describe, expect, it } from 'vitest';
import type { Game } from '@/lib/types';
import { loadsFromRows, normalizeRoster, removeGame, rowToGame, stripPrivate, upsertGame } from './rows';

const g = (id: string, date: string) => ({ id, date }) as Game;

describe('rows', () => {
  it('rowToGame forces doc.id = row.id', () => {
    expect(rowToGame({ id: 'a', date: '2026-09-01', doc: { id: 'zzz', date: '2026-09-01' } as Game }).id).toBe('a');
  });
  it('upsert keeps date order and replaces', () => {
    const gs = upsertGame([g('b', '2026-09-05'), g('a', '2026-09-01')], g('c', '2026-09-03'));
    expect(gs.map((x) => x.id)).toEqual(['a', 'c', 'b']);
    expect(upsertGame(gs, { ...g('c', '2026-09-03'), opp: 'X' }).find((x) => x.id === 'c')?.opp).toBe('X');
    expect(removeGame(gs, 'c').map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('loadsFromRows maps game_id', () => {
    expect(loadsFromRows([{ game_id: 'a', rows: [], updated_at: 't' }])).toEqual({ a: { rows: [], updatedAt: 't' } });
  });
  it('normalizeRoster handles wrapper and bare', () => {
    const r = { Smith: { pos: 'MID' as const } };
    expect(normalizeRoster({ players: r })).toEqual(r);
    expect(normalizeRoster(r)).toEqual(r);
  });
});

describe('stripPrivate', () => {
  it('drops _keys deeply', () => {
    expect(stripPrivate({ a: 1, _b: 2, c: [{ _d: 1, e: 2 }], f: { _g: 1 } })).toEqual({ a: 1, c: [{ e: 2 }], f: {} });
  });
});
