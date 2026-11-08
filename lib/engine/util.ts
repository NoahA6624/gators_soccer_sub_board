// Small formatting helpers (L594–608 of the original). Shared by everyone; edit only via agent A.
export const clk = (m: number | null | undefined) =>
  m == null || isNaN(m) ? '—' : Math.floor(m) + ':' + String(Math.round((m % 1) * 60) % 60).padStart(2, '0');
export const dm = (m: number | null | undefined) => (m == null || isNaN(m) ? '—' : m.toFixed(1) + "'");
export const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const RES = { W: 'Win', L: 'Loss', T: 'Tie' } as const;
export const HN = { h1: '1st half', h2: '2nd half', full: 'Full match' } as const;
export const SEC_SCHOOLS = ['alabama', 'arkansas', 'auburn', 'florida', 'georgia', 'kentucky', 'lsu', 'ole miss', 'mississippi state', 'missouri', 'oklahoma', 'south carolina', 'tennessee', 'texas', 'texas a&m', 'vanderbilt'];
export const normName = (s: string) =>
  s.toLowerCase().replace(/\bst\.?$/, 'state').replace(/\bst\.\s/, 'state ').replace(/[^a-z&() ]/g, '').replace(/\s+/g, ' ').trim();
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const gameId = (date: string, opp: string) => `${date}-${slug(opp)}`;
