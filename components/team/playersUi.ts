'use client';
// Persisted Players-tab UI state (useBoard().ui.players): mode, sorts, selected player.
import { useCallback } from 'react';
import { useBoard } from '@/lib/data/board';

export interface SortState { key: string; dir: 1 | -1 }
export interface PlayersUi {
  mode: 'off' | 'on';
  sort: SortState; // halves table: 'name' | 'starts' | 'avg'
  fsort: SortState; // full-match table: 'name' | 'g' | 'min' | 'spell'
  player: string | null;
}
export const DEFAULT_PLAYERS_UI: PlayersUi = { mode: 'off', sort: { key: 'starts', dir: -1 }, fsort: { key: 'min', dir: -1 }, player: null };

export function usePlayersUi(): [PlayersUi, (p: Partial<PlayersUi>) => void] {
  const { ui, setUi } = useBoard();
  const cur: PlayersUi = { ...DEFAULT_PLAYERS_UI, ...((ui.players as Partial<PlayersUi>) ?? {}) };
  const update = useCallback(
    (p: Partial<PlayersUi>) => setUi('players', { ...DEFAULT_PLAYERS_UI, ...((ui.players as Partial<PlayersUi>) ?? {}), ...p }),
    [ui.players, setUi],
  );
  return [cur, update];
}
