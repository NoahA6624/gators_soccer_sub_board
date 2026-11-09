'use client';
// Player minutes per match + exports. Port of minutesPanel/bindMinutes/saveFile (gator-sub-board.html L1126–1165).
import { useMemo, useState } from 'react';
import { useBoard } from '@/lib/data/board';
import { buildNameIndex, fullD, playerLabel } from '@/lib/engine';
import { downloadBlob, exportMinutesPdf, exportReport, exportXlsx, gamesToCsv, type FileOut } from '@/lib/export';
import type { Game } from '@/lib/types';
import { MCOLS, minutesRowsLocal, sortRows, totalOf, type MinKey } from './helpers';

type Status = { kind: 'ok' | 'err' | 'busy'; text: string } | null;

export function MinutesPanel({ g, games }: { g: Game; games: Game[] }) {
  const { roster, loads, ui, setUi } = useBoard();
  const idx = useMemo(() => buildNameIndex(games, roster), [games, roster]);
  const ms = (ui.msort as { key: MinKey; dir: number }) || { key: 'full', dir: -1 };
  const [status, setStatus] = useState<Status>(null);

  const { rows: raw, unused, END } = useMemo(() => minutesRowsLocal(g, games, roster), [g, games, roster]);
  const rows = sortRows(raw, ms.key, ms.dir);
  const reds = fullD(g)?.reds ?? [];

  const sortBy = (k: Exclude<MinKey, 'order'>) => {
    const def = MCOLS.find((c) => c[0] === k)?.[2] ?? 1;
    setUi('msort', ms.key === k ? { key: k, dir: -ms.dir } : { key: k, dir: def });
  };

  // saveFile (L1150): the board runs in a normal browser, so download via a blob link.
  const run = async (busy: string, fn: () => FileOut | Promise<FileOut>) => {
    setStatus({ kind: 'busy', text: busy });
    try {
      const out = await fn();
      downloadBlob(out);
      setStatus({ kind: 'ok', text: `Saved ${out.filename}.` });
    } catch (e) {
      setStatus({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <section className="panel" id="minutes">
      <div className="gamehead" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Player minutes · {g.opp}</h2>
        <div className="form">
          <button type="button" className="btn primary" onClick={() => run('Building the match report…', () => exportReport(g, loads))}>Match report (PDF)</button>
          <button type="button" className="btn" onClick={() => run('Building the PDF…', () => exportMinutesPdf(g))}>Minutes sheet (PDF)</button>
          <button type="button" className="btn" onClick={() => run('Building the spreadsheet…', () => exportXlsx([g]))}>Excel · this match</button>
          <button type="button" className="btn" onClick={() => run('Building the spreadsheet…', () => exportXlsx(games))}>Excel · all matches</button>
          <button type="button" className="btn" onClick={() => run('Building the CSV…', () => gamesToCsv(games))}>CSV · all matches</button>
        </div>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              {MCOLS.map(([k, l]) => (
                <th key={k} className="sortable" onClick={() => sortBy(k)} style={k === 'spells' || k === 'p' ? { textAlign: 'left' } : undefined}>
                  {l} {ms.key === k && <span className="dir">{ms.dir === -1 ? '↓' : '↑'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p}>
                <td className="tnum dim">{r.num}</td>
                <td style={{ textAlign: 'left' }}><span className="pname">{playerLabel(r.p, idx)}</span></td>
                <td>{r.pos}</td>
                <td>{r.role}</td>
                <td className="tnum big">{r.m1.toFixed(1)}</td>
                <td className="tnum big">{r.m2.toFixed(1)}</td>
                <td className="tnum big" style={{ color: 'var(--blue)' }}>{r.full.toFixed(1)}</td>
                <td className="tnum muted" style={{ textAlign: 'left', whiteSpace: 'normal', fontSize: 13 }}>{r.spells}</td>
              </tr>
            ))}
            <tr>
              <td /><td style={{ textAlign: 'left' }}><b>Team total</b></td><td /><td />
              <td className="tnum"><b>{totalOf(rows, 'x1').toFixed(1)}</b></td>
              <td className="tnum"><b>{totalOf(rows, 'x2').toFixed(1)}</b></td>
              <td className="tnum"><b>{totalOf(rows, 'xf').toFixed(1)}</b></td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      {!rows.length && <div className="empty">No minutes for this match yet.</div>}
      <p className="note">
        {reds.map((r, i) => (
          <b className="err" key={i}>Red card: {playerLabel(r.player, idx)} at {Math.floor(r.min)}&apos;, so Florida played a player down from there. </b>
        ))}
        {unused.length ? `Did not play: ${unused.map((p) => playerLabel(p, idx)).join(', ')}. ` : ''}
        Minutes are rebuilt from the official play-by-play (one decimal = tenths of a minute). Halftime is 45:00 and stoppage time isn&apos;t added
        {END > 90 ? `; overtime runs to ${END}'` : ''}.
      </p>
      <p className="note" style={{ marginTop: 4 }}>
        Click any column to sort (first click = highest first).{' '}
        {ms.key !== 'order' && <button type="button" className="linkbtn" onClick={() => setUi('msort', { key: 'order', dir: 1 })}>Show lineup order</button>}
      </p>
      <div className="status" role="status">
        {status && <span className={status.kind === 'busy' ? undefined : status.kind}>{status.text}</span>}
      </div>
    </section>
  );
}
