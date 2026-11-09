// Tiny in-process bus: mutations publish successful writes so BoardProvider updates immediately
// (realtime echoes the same change a moment later; applying it twice is idempotent).
import type { Game, GameLoads, Roster } from '@/lib/types';

export type BoardChange =
  | { kind: 'game'; game: Game }
  | { kind: 'gameDeleted'; id: string }
  | { kind: 'loads'; gameId: string; loads: GameLoads }
  | { kind: 'loadsDeleted'; gameId: string }
  | { kind: 'roster'; roster: Roster };

type Listener = (c: BoardChange) => void;
const listeners = new Set<Listener>();

export function onBoardChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function emitBoardChange(c: BoardChange): void {
  listeners.forEach((fn) => fn(c));
}
