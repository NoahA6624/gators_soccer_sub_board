// Write API. OWNED BY AGENT B. UI calls these only (never supabase directly).
// RLS enforces editor-only writes; a viewer's call rejects with the Postgres error message.
import type { Game, GameLoads, Roster } from '@/lib/types';
import { requireBrowserClient } from '@/lib/supabase/client';
import { emitBoardChange } from './bus';
import { stripPrivate } from './rows';

export { stripPrivate };

function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what} failed: ${error.message}`);
}

export async function saveGame(g: Game): Promise<void> {
  if (!g.id) throw new Error('saveGame: game.id is required');
  const doc = stripPrivate(g);
  const { error } = await requireBrowserClient()
    .from('games')
    .upsert({ id: doc.id, date: doc.date, doc, updated_at: new Date().toISOString() });
  fail('saveGame', error);
  emitBoardChange({ kind: 'game', game: doc });
}

export async function deleteGame(id: string): Promise<void> {
  const sb = requireBrowserClient();
  const { error } = await sb.from('games').delete().eq('id', id);
  fail('deleteGame', error);
  // Loads belong to the game; remove them too (best effort, matches original board behaviour).
  const { error: lerr } = await sb.from('loads').delete().eq('game_id', id);
  fail('deleteGame (loads)', lerr);
  emitBoardChange({ kind: 'gameDeleted', id });
  emitBoardChange({ kind: 'loadsDeleted', gameId: id });
}

export async function saveRoster(players: Roster): Promise<void> {
  const clean = stripPrivate(players);
  const { error } = await requireBrowserClient()
    .from('roster')
    .upsert({ id: 'roster', players: clean, updated_at: new Date().toISOString() });
  fail('saveRoster', error);
  emitBoardChange({ kind: 'roster', roster: clean });
}

export async function saveLoads(gameId: string, loads: GameLoads): Promise<void> {
  const updatedAt = loads.updatedAt || new Date().toISOString();
  const rows = stripPrivate(loads.rows || []);
  const { error } = await requireBrowserClient()
    .from('loads')
    .upsert({ game_id: gameId, rows, updated_at: updatedAt });
  fail('saveLoads', error);
  emitBoardChange({ kind: 'loads', gameId, loads: { rows, updatedAt } });
}

export async function signOut(): Promise<void> {
  const { error } = await requireBrowserClient().auth.signOut();
  fail('signOut', error);
}
