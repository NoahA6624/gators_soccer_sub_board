// Import a BoardExport JSON (original board → "Download all data (JSON)") into Supabase.
// Usage: npx tsx scripts/seed.ts path/to/export.json
// The JSON path comes from argv only; keep exports OUTSIDE the repo (team data never goes in git).
import { readFileSync } from 'node:fs';
import type { BoardExport, Game } from '../lib/types';
import { normalizeRoster, stripPrivate } from '../lib/data/rows';
import { scriptAdminClient } from './_supabase-admin';

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('Usage: npx tsx scripts/seed.ts path/to/export.json'); process.exit(1); }
  const data = JSON.parse(readFileSync(file, 'utf8')) as Partial<BoardExport>;
  const games = (data.games ?? []).filter((g): g is Game => !!g && !!g.id && !!g.date);
  const roster = normalizeRoster(data.roster);
  const loads = data.loads ?? {};
  const sb = scriptAdminClient();
  const now = new Date().toISOString();

  for (let i = 0; i < games.length; i += 50) {
    const chunk = games.slice(i, i + 50).map((g) => { const doc = stripPrivate(g); return { id: doc.id, date: doc.date, doc, updated_at: now }; });
    const { error } = await sb.from('games').upsert(chunk);
    if (error) throw new Error(`games: ${error.message}`);
  }
  const loadRows = Object.entries(loads).map(([game_id, l]) => ({ game_id, rows: stripPrivate(l?.rows ?? []), updated_at: l?.updatedAt || now }));
  if (loadRows.length) {
    const { error } = await sb.from('loads').upsert(loadRows);
    if (error) throw new Error(`loads: ${error.message}`);
  }
  if (Object.keys(roster).length) {
    const { error } = await sb.from('roster').upsert({ id: 'roster', players: stripPrivate(roster), updated_at: now });
    if (error) throw new Error(`roster: ${error.message}`);
  }
  console.log(`Seeded ${games.length} games, ${loadRows.length} load sets, ${Object.keys(roster).length} roster players.`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
