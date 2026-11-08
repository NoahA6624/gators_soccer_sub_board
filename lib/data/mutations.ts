// Write API. OWNED BY AGENT B. UI calls these only (never supabase directly).
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Game, GameLoads, Roster } from '@/lib/types';

export async function saveGame(g: Game): Promise<void> { throw new Error('saveGame: not implemented'); }
export async function deleteGame(id: string): Promise<void> { throw new Error('deleteGame: not implemented'); }
export async function saveRoster(players: Roster): Promise<void> { throw new Error('saveRoster: not implemented'); }
export async function saveLoads(gameId: string, loads: GameLoads): Promise<void> { throw new Error('saveLoads: not implemented'); }
