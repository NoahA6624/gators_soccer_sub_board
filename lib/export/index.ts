// Exporters. OWNED BY AGENT C. All return a Blob + filename; UI calls downloadBlob().
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import type { Game, LoadsByGame, Roster } from '@/lib/types';

export interface FileOut { filename: string; blob: Blob }

export function downloadBlob({ filename, blob }: FileOut) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function gamesToCsv(games: Game[]): FileOut { throw new Error('gamesToCsv: not implemented'); }
export function boardToJson(games: Game[], roster: Roster, loads: LoadsByGame): FileOut { throw new Error('boardToJson: not implemented'); }
export async function exportXlsx(games: Game[]): Promise<FileOut> { throw new Error('exportXlsx: not implemented'); }
export async function exportMinutesPdf(game: Game): Promise<FileOut> { throw new Error('exportMinutesPdf: not implemented'); }
export async function exportReport(game: Game, loads?: LoadsByGame): Promise<FileOut> { throw new Error('exportReport: not implemented'); }
/** Strategy sheet (L1984–2017). `st` is the result of stStats(). */
export async function stPdf(st: any, label: string): Promise<FileOut> { throw new Error('stPdf: not implemented'); }
export async function envRankPdf(rows: any[], label: string): Promise<FileOut> { throw new Error('envRankPdf: not implemented'); }
export async function scnPdf(scn: any, label: string): Promise<FileOut> { throw new Error('scnPdf: not implemented'); }
