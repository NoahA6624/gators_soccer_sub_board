// Player display names. EVERY UI surface must render players via playerLabel()/usePlayerLabel().
// Format: "#19 - Mary Jane". Players are keyed internally by last name (unchanged).
// Fallbacks: no number -> "Mary Jane"; no first name -> "#19 - Jane"; neither -> "Jane".
import type { Game, Roster } from '@/lib/types';

export interface PlayerIdent { num?: string; first?: string; last: string }
export type NameIndex = Record<string, PlayerIdent>;

/** Build last-name -> {num, first} from the most recent lineup appearance; roster entries override. */
export function buildNameIndex(games: Game[], roster: Roster = {}): NameIndex {
  const idx: NameIndex = {};
  const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));
  for (const g of sorted) {
    for (const p of [...(g.lineup?.starters ?? []), ...(g.lineup?.bench ?? [])]) {
      const cur = idx[p.name] ?? { last: p.name };
      idx[p.name] = { last: p.name, num: p.num || cur.num, first: p.first || cur.first };
    }
  }
  for (const [last, r] of Object.entries(roster)) {
    const cur = idx[last] ?? { last };
    idx[last] = { last, num: r.num || cur.num, first: r.first || cur.first };
  }
  return idx;
}

export function formatPlayer(p: PlayerIdent): string {
  const nm = p.first ? `${p.first} ${p.last}` : p.last;
  const num = p.num != null && String(p.num).trim() !== '' ? String(p.num).replace(/^#/, '') : null;
  return num ? `#${num} - ${nm}` : nm;
}

export function playerLabel(last: string, idx: NameIndex): string {
  return formatPlayer(idx[last] ?? { last });
}
