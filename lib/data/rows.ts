// Pure mappers between Supabase rows and board shapes (unit-tested).
import type { Game, GameLoads, LoadsByGame, Roster } from '@/lib/types';

export interface GameRow { id: string; date: string; doc: Game | null }
export interface LoadsRow { game_id: string; rows: GameLoads['rows'] | null; updated_at?: string | null }
export interface RosterRow { id: string; players: Roster | null }

export function rowToGame(r: GameRow): Game {
  const doc = (r.doc ?? {}) as Game;
  return { ...doc, id: r.id, date: doc.date || r.date };
}

export function rowToLoads(r: LoadsRow): GameLoads {
  return { rows: r.rows ?? [], updatedAt: r.updated_at ?? undefined };
}

export function loadsFromRows(rows: LoadsRow[]): LoadsByGame {
  const out: LoadsByGame = {};
  for (const r of rows) out[r.game_id] = rowToLoads(r);
  return out;
}

const byDate = (a: Game, b: Game) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function sortGames(gs: Game[]): Game[] {
  return [...gs].sort(byDate);
}

/** Insert or replace a game by id, keeping date order. */
export function upsertGame(gs: Game[], g: Game): Game[] {
  return sortGames([...gs.filter((x) => x.id !== g.id), g]);
}

export function removeGame(gs: Game[], id: string): Game[] {
  return gs.some((g) => g.id === id) ? gs.filter((g) => g.id !== id) : gs;
}

/** Accept either a bare Roster or the `{ players }` export wrapper. */
export function normalizeRoster(r: Roster | { players: Roster } | null | undefined): Roster {
  if (!r) return {};
  if ('players' in r && r.players && typeof r.players === 'object' && !('pos' in r.players)) return r.players as Roster;
  return r as Roster;
}

/** Deep-copy dropping every key that starts with '_' (transient UI/cache fields). */
export function stripPrivate<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripPrivate) as unknown as T;
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (!k.startsWith('_') && val !== undefined) out[k] = stripPrivate(val);
    }
    return out as T;
  }
  return v;
}
