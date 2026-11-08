// Importers. OWNED BY AGENT C (pdf/csv/gps/json) and AGENT E (ncaa.ts). Stubs until they land.
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { BoardExport, Game, LoadRow } from '@/lib/types';

export const CSV_COLS = ['game_id', 'date', 'opponent', 'venue', 'tier', 'half', 'clock', 'team', 'type', 'player', 'player_on', 'player_off', 'pos', 'num', 'detail'] as const;

/** Parse box-score PDFs in the browser (pdf.js). Returns parsed games for review (not saved). */
export async function parsePdfFiles(files: File[]): Promise<{ game?: Game; file: string; error?: string }[]> { throw new Error('parsePdfFiles: not implemented'); }
export function gamesFromTagCsv(text: string): Game[] { throw new Error('gamesFromTagCsv: not implemented'); }
export function parseBoardJson(text: string): BoardExport { throw new Error('parseBoardJson: not implemented'); }

export interface GpsParse {
  headers: string[];
  map: Record<'player' | 'dist' | 'hsr' | 'sprint' | 'acc' | 'dec', number>;
  rows: string[][];
}
export function parseGpsCsv(text: string): GpsParse { throw new Error('parseGpsCsv: not implemented'); }
/** Match GPS names to a game's lineup last names; manual overrides win. */
export function matchGpsRows(p: GpsParse, game: Game, half: 1 | 2, overrides?: Record<string, string>): { rows: LoadRow[]; unmatched: string[] } { throw new Error('matchGpsRows: not implemented'); }
