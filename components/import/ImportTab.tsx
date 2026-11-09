'use client';
// Add data tab (renderImport L1477–1528, handlePdfs L1533, renderPending L1542).
// New routes: paste NCAA play-by-play HTML (parseNcaaHtml, agent E) and per-game weather fetch.
import { useRef, useState, type DragEvent } from 'react';
import { useBoard } from '@/lib/data/board';
import { normName, SEC_SCHOOLS } from '@/lib/engine';
import { CSV_COLS, gamesFromTagCsv, parseBoardJson, parsePdfFiles } from '@/lib/import';
import { saveLoads, saveRoster } from '@/lib/data/mutations';
import type { BoardExport, Game, Roster } from '@/lib/types';
import { PendingGame, type Pending } from './PendingGame';
import { GpsLoads } from './GpsLoads';
import { RosterEditor } from './RosterEditor';
import { Manage } from './Manage';
import { errText, Status, useMsg } from './Status';

let seq = 0;
const withDefaults = (g: Game): Game => ({
  ...g,
  tier: g.tier || 'Non-P4',
  conf: g.conf ?? (SEC_SCHOOLS.includes(normName(g.opp || '')) ? 'SEC' : 'Non-conf'),
  lineup: g.lineup ?? { starters: [], bench: [] },
  events: g.events ?? [],
  ht: g.ht ?? { uf: 0, opp: 0 },
});
const mk = (game: Game, extra: Partial<Pending> = {}): Pending => ({ key: `p${++seq}`, game: withDefaults(game), ...extra });

type NcaaFn = (html: string, opts?: { boxHtml?: string }) => unknown;

export function ImportTab() {
  const { games, loads, roster, canEdit } = useBoard();
  const [pending, setPending] = useState<Pending[]>([]);
  const [pdfMsg, setPdfMsg] = useMsg();
  const [ncaaMsg, setNcaaMsg] = useMsg();
  const [csvMsg, setCsvMsg] = useMsg();
  const [jsonMsg, setJsonMsg] = useMsg();
  const [over, setOver] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [pbp, setPbp] = useState('');
  const [box, setBox] = useState('');
  const [ncaaBusy, setNcaaBusy] = useState(false);
  const [restore, setRestore] = useState<BoardExport | null>(null);
  const pendRef = useRef<HTMLDivElement>(null);

  if (!canEdit) {
    return <div className="panel empty">View only. Only editors of this board can add games or GPS data. Ask the owner for Editor access.</div>;
  }

  const add = (ps: Pending[]) => {
    if (!ps.length) return;
    setPending((p) => [...p, ...ps]);
    setTimeout(() => pendRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handlePdfs = async (files: File[]) => {
    if (!files.length) return;
    setPdfMsg({ kind: 'plain', text: 'Reading…' });
    try {
      const res = await parsePdfFiles(files);
      const ok = res.filter((r) => r.game).map((r) => mk(r.game as Game, { file: r.file }));
      const errs = res.filter((r) => !r.game).map((r) => `${r.file}: ${r.error ?? 'could not read'}`);
      add(ok);
      setPdfMsg({ kind: ok.length ? 'ok' : 'err', text: ok.length ? `Read ${ok.length} game${ok.length > 1 ? 's' : ''}. Check the details below, then save.` : 'No games read.', lines: errs });
    } catch (e) {
      setPdfMsg({ kind: 'err', text: errText(e) });
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    handlePdfs([...e.dataTransfer.files].filter((f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)));
  };

  const readNcaa = async () => {
    if (!pbp.trim()) { setNcaaMsg({ kind: 'err', text: 'Paste the play-by-play page HTML first.' }); return; }
    setNcaaBusy(true);
    setNcaaMsg({ kind: 'plain', text: 'Reading…' });
    try {
      const mod = (await import('@/lib/import')) as unknown as Record<string, unknown>;
      const fn = mod.parseNcaaHtml as NcaaFn | undefined;
      if (typeof fn !== 'function') { setNcaaMsg({ kind: 'warn', text: 'NCAA import is not available yet.' }); return; }
      const r = (await fn(pbp, { boxHtml: box.trim() || undefined })) as { game?: Game; warnings?: string[] } | Game | null;
      const game = r && 'game' in r ? r.game : (r as Game | null);
      const warnings = (r && 'warnings' in r && Array.isArray(r.warnings) ? r.warnings : []) as string[];
      if (!game || !game.date) throw new Error('No game found in that HTML.');
      add([mk({ ...game, source: game.source ?? 'ncaa' }, { warnings })]);
      setNcaaMsg({ kind: 'ok', text: `Read ${game.opp} (${game.date}). Check the details below, then save.`, lines: warnings });
      setPbp('');
      setBox('');
    } catch (e) {
      setNcaaMsg({ kind: 'err', text: errText(e) });
    } finally {
      setNcaaBusy(false);
    }
  };

  const readCsv = () => {
    try {
      const gs = gamesFromTagCsv(csvText);
      if (!gs.length) throw new Error('No games found in that CSV.');
      add(gs.map((g) => mk(g)));
      setCsvMsg({ kind: 'ok', text: `Read ${gs.length} game(s). Review them below and save.` });
    } catch (e) {
      setCsvMsg({ kind: 'err', text: errText(e) });
    }
  };

  const readJson = async (f?: File) => {
    if (!f) return;
    try {
      const b = parseBoardJson(await f.text());
      setRestore(b);
      add((b.games ?? []).map((g) => mk(g)));
      setJsonMsg({ kind: 'ok', text: `Read ${b.games?.length ?? 0} games${Object.keys(b.loads ?? {}).length ? `, GPS for ${Object.keys(b.loads).length}` : ''}. Review games below; roster and GPS save separately.` });
    } catch (e) {
      setJsonMsg({ kind: 'err', text: errText(e) });
    }
  };
  const saveRestore = async () => {
    if (!restore) return;
    try {
      const r = restore.roster as Roster | { players: Roster };
      const players = ('players' in r && typeof r.players === 'object' ? r.players : r) as Roster;
      if (Object.keys(players).length) await saveRoster({ ...roster, ...players });
      for (const [gid, l] of Object.entries(restore.loads ?? {})) await saveLoads(gid, l);
      setJsonMsg({ kind: 'ok', text: 'Saved roster and GPS from the file.' });
      setRestore(null);
    } catch (e) {
      setJsonMsg({ kind: 'err', text: `Couldn't save (${errText(e)}).` });
    }
  };

  return (
    <div className="stack">
      <section className="panel">
        <h2>Add a game from NCAA live stats</h2>
        <p className="note">Open the match&apos;s play-by-play page on stats.ncaa.org, view the page source (Ctrl+U), select all and paste it here. Paste the box score page too for minutes, numbers and positions (optional).</p>
        <textarea rows={4} style={{ width: '100%' }} placeholder="Paste play-by-play page HTML" value={pbp} onChange={(e) => setPbp(e.target.value)} />
        <textarea rows={3} style={{ width: '100%', marginTop: 8 }} placeholder="Optional: paste box score page HTML" value={box} onChange={(e) => setBox(e.target.value)} />
        <div className="form" style={{ marginTop: 8 }}>
          <button type="button" className="btn primary" disabled={ncaaBusy} onClick={readNcaa}>{ncaaBusy ? 'Reading…' : 'Read NCAA game'}</button>
        </div>
        <Status msg={ncaaMsg} />
      </section>

      <section className="panel">
        <h2>Add a game from the PDF</h2>
        <label className={`drop${over ? ' over' : ''}`} htmlFor="pdfIn"
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
          <b>Drop box score PDFs here</b> or click to choose. Several at once is fine.<br />
          <span className="dim">The report with the box score and play-by-play. It&apos;s read in your browser.</span>
        </label>
        <input type="file" id="pdfIn" accept="application/pdf" multiple hidden onChange={(e) => { handlePdfs([...(e.target.files ?? [])]); e.target.value = ''; }} />
        <Status msg={pdfMsg} />
      </section>

      <div ref={pendRef} className="stack">
        {pending.length > 0 && <h3 style={{ margin: 0 }}>Review before saving · {pending.length}</h3>}
        {pending.map((p) => (
          <PendingGame key={p.key} p={p} exists={games.some((x) => x.id === p.game.id)}
            onChange={(g) => setPending((ps) => ps.map((x) => (x.key === p.key ? { ...x, game: g } : x)))}
            onDrop={() => setPending((ps) => ps.filter((x) => x.key !== p.key))}
            onSaved={(g) => {
              setPending((ps) => ps.filter((x) => x.key !== p.key));
              setPdfMsg({ kind: 'ok', text: `Saved ${g.opp}. It's live on every tab.` });
            }} />
        ))}
      </div>

      <section className="panel">
        <h2>Add games from your own tagging (CSV)</h2>
        <p className="note">Same format the board exports, so tagged games and PDF games work the same way. Lineup rows use <b>START</b> / <b>BENCH</b>; events use <b>SUB</b>, <b>GOAL</b>, <b>SHOT</b>, <b>CARD</b>, <b>CORNER</b>. Clock is match time (mm:ss), half is 1 or 2, team is UF or OPP.</p>
        <details><summary>Column format and example</summary><pre className="code">{`${CSV_COLS.join(',')}
,2026-10-02,Georgia,Home,P4,,,UF,START,Barnes,,,DEF,33,
,2026-10-02,Georgia,Home,P4,,,UF,BENCH,Sindelar,,,MID,17,
,2026-10-02,Georgia,Home,P4,1,18:40,UF,SUB,,Sindelar,Hess,,,
,2026-10-02,Georgia,Home,P4,1,22:05,UF,GOAL,Taylor,,,,,
,2026-10-02,Georgia,Home,P4,1,26:10,OPP,SHOT,,,,,,`}</pre></details>
        <div className="form" style={{ marginTop: 10 }}>
          <input type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsvText(await f.text()); }} />
          <span className="dim">or paste below</span>
        </div>
        <textarea rows={4} style={{ width: '100%', marginTop: 8 }} placeholder="Paste tagged CSV rows here" value={csvText} onChange={(e) => setCsvText(e.target.value)} />
        <div className="form" style={{ marginTop: 8 }}><button type="button" className="btn" onClick={readCsv}>Read tagged games</button></div>
        <Status msg={csvMsg} />
      </section>

      <GpsLoads games={games} loads={loads} roster={roster} />

      <RosterEditor games={games} roster={roster} />

      <section className="panel">
        <h2>Restore from a JSON export</h2>
        <p className="note">A file from &quot;Download all data (JSON)&quot;. Games go into the review list above; roster and GPS are saved with the button below.</p>
        <div className="form">
          <input type="file" accept=".json,application/json" onChange={(e) => readJson(e.target.files?.[0])} />
          {restore && <button type="button" className="btn" onClick={saveRestore}>Save roster and GPS from file</button>}
        </div>
        <Status msg={jsonMsg} />
      </section>

      <Manage games={games} roster={roster} loads={loads} />
    </div>
  );
}
