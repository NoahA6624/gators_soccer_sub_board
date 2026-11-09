'use client';
// GPS by half (handleLoads, L1568–1587): column remap dropdowns + manual-match table.
import { useMemo, useState } from 'react';
import { buildNameIndex, playerLabel } from '@/lib/engine';
import { matchGpsRows, parseGpsCsv, type GpsParse } from '@/lib/import';
import { saveLoads } from '@/lib/data/mutations';
import type { Game, LoadRow, LoadsByGame, Roster } from '@/lib/types';
import { errText, Status, useMsg } from './Status';

type ColKey = keyof GpsParse['map'];
const COLS: [ColKey, string][] = [['player', 'Player name'], ['dist', 'Total distance (m)'], ['hsr', 'HSR (m)'], ['sprint', 'Sprint distance (m)'], ['acc', 'Accels'], ['dec', 'Decels']];

export function GpsLoads({ games, loads, roster }: { games: Game[]; loads: LoadsByGame; roster: Roster }) {
  const idx = useMemo(() => buildNameIndex(games, roster), [games, roster]);
  const [gid, setGid] = useState<string>('');
  const [half, setHalf] = useState<1 | 2>(1);
  const [parsed, setParsed] = useState<GpsParse | null>(null);
  const [over, setOver] = useState<Record<string, string>>({});
  const [msg, setMsg] = useMsg();
  const [busy, setBusy] = useState(false);
  const game = games.find((g) => g.id === (gid || games[games.length - 1]?.id));
  const names = useMemo(() => (game ? [...game.lineup.starters, ...game.lineup.bench].map((p) => p.name) : []), [game]);

  const match = useMemo(() => {
    if (!parsed || !game) return null;
    try {
      return { ...matchGpsRows(parsed, game, half, over), error: null as string | null };
    } catch (e) {
      return { rows: [] as LoadRow[], unmatched: [] as string[], error: errText(e) };
    }
  }, [parsed, game, half, over]);

  // Raw GPS names that were matched manually (so they stay listed in the manual-match table).
  const manual = Object.keys(over).filter((k) => over[k]);
  const manualRows = [...new Set([...(match?.unmatched ?? []), ...manual])];

  const onFile = async (f?: File) => {
    if (!f) return;
    setMsg(null);
    setOver({});
    try {
      const p = parseGpsCsv(await f.text());
      if (!p.rows.length) throw new Error('That file has no rows.');
      setParsed(p);
    } catch (e) {
      setParsed(null);
      setMsg({ kind: 'err', text: errText(e) });
    }
  };

  const save = async () => {
    if (!game || !match) return;
    if (!match.rows.length) { setMsg({ kind: 'err', text: 'No players matched.' }); return; }
    setBusy(true);
    try {
      const keep = (loads[game.id]?.rows ?? []).filter((x) => (x.half || 1) !== half);
      await saveLoads(game.id, { rows: keep.concat(match.rows), updatedAt: new Date().toISOString() });
      setMsg({ kind: 'ok', text: `Saved GPS for ${match.rows.length} players. HSR per minute now shows on Players and in profiles.` });
    } catch (e) {
      setMsg({ kind: 'err', text: `Couldn't save (${errText(e)}).` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <h2>Add GPS by half (STATSports CSV)</h2>
      <p className="note">Export one half (period) for one match and pick which half it is. Rows are matched to players by last name. Distance, high-speed running (HSR), sprint distance and accels/decels are read when present; per-minute rates use each player&apos;s minutes in that half from the sub data.</p>
      <div className="form">
        <div className="field"><span className="label">Game</span>
          <select value={game?.id ?? ''} onChange={(e) => setGid(e.target.value)}>
            {games.map((g) => <option key={g.id} value={g.id}>{g.date} · {g.opp}</option>)}
          </select></div>
        <div className="field"><span className="label">Half</span>
          <select value={half} onChange={(e) => setHalf(+e.target.value as 1 | 2)}>
            <option value={1}>1st half</option><option value={2}>2nd half</option>
          </select></div>
        <div className="field"><span className="label">CSV</span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} /></div>
      </div>
      {parsed && (
        <div style={{ marginTop: 10 }}>
          <div className="form">
            {COLS.map(([k, l]) => (
              <div className="field" key={k}><span className="label">{l}</span>
                <select value={parsed.map[k] ?? -1} onChange={(e) => setParsed({ ...parsed, map: { ...parsed.map, [k]: +e.target.value } })}>
                  <option value={-1}>—</option>
                  {parsed.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select></div>
            ))}
            <button type="button" className="btn primary" disabled={busy || !match?.rows.length} onClick={save}>{busy ? 'Saving…' : 'Save GPS for this game'}</button>
          </div>
          <div className="note" style={{ marginTop: 8 }}>
            {match?.error ? <span className="err">{match.error}</span> : (
              <>Matched <b>{match?.rows.length ?? 0}</b> players{match?.unmatched.length ? <> · <span className="warn">not matched: {match.unmatched.join(', ')}</span></> : null}.</>
            )}
          </div>
          {manualRows.length > 0 && (
            <div className="tablewrap" style={{ marginTop: 8 }}>
              <table>
                <thead><tr><th style={{ textAlign: 'left' }}>Name in GPS file</th><th style={{ textAlign: 'left' }}>Match to player</th></tr></thead>
                <tbody>
                  {manualRows.map((raw) => (
                    <tr key={raw}>
                      <td style={{ textAlign: 'left' }}>{raw}</td>
                      <td style={{ textAlign: 'left' }}>
                        <select value={over[raw] ?? ''} onChange={(e) => setOver({ ...over, [raw]: e.target.value })}>
                          <option value="">— skip —</option>
                          {names.map((n) => <option key={n} value={n}>{playerLabel(n, idx)}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {match && match.rows.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary>Matched rows ({match.rows.length})</summary>
              <div className="tablewrap"><table>
                <thead><tr><th style={{ textAlign: 'left' }}>Player</th><th>Dist</th><th>HSR</th><th>Sprint</th><th>Acc+Dec</th></tr></thead>
                <tbody>{match.rows.map((r, i) => (
                  <tr key={i}><td style={{ textAlign: 'left' }}>{playerLabel(r.player, idx)}</td>
                    <td className="tnum">{r.dist ?? '—'}</td><td className="tnum">{r.hsr ?? '—'}</td><td className="tnum">{r.sprint ?? '—'}</td><td className="tnum">{r.acc ?? '—'}</td></tr>
                ))}</tbody>
              </table></div>
            </details>
          )}
        </div>
      )}
      <Status msg={msg} />
    </section>
  );
}
