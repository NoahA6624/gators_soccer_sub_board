'use client';
// Export and manage (L1520–1530): exports, season stage, remove a game.
import { useState } from 'react';
import { boardToJson, downloadBlob, gamesToCsv, type FileOut } from '@/lib/export';
import { deleteGame, saveGame } from '@/lib/data/mutations';
import type { Game, LoadsByGame, Roster } from '@/lib/types';
import { errText, Status, useMsg } from './Status';

export function Manage({ games, roster, loads }: { games: Game[]; roster: Roster; loads: LoadsByGame }) {
  const [msg, setMsg] = useMsg();
  const [stgId, setStgId] = useState('');
  const [stgVal, setStgVal] = useState<string | null>(null);
  const [delId, setDelId] = useState('');
  const [confirm, setConfirm] = useState(false);
  const sg = games.find((g) => g.id === stgId) ?? games[0];
  const dg = games.find((g) => g.id === delId) ?? games[0];
  const stage = stgVal ?? (sg?.stage === 'Postseason' ? 'Postseason' : '');

  const exp = async (fn: () => FileOut | Promise<FileOut>) => {
    try {
      const f = await fn();
      downloadBlob(f);
      setMsg({ kind: 'ok', text: `Saved ${f.filename}.` });
    } catch (e) {
      setMsg({ kind: 'err', text: `Couldn't export (${errText(e)}).` });
    }
  };
  const saveStage = async () => {
    if (!sg) return;
    const doc: Game = { ...sg };
    if (stage) doc.stage = stage; else delete doc.stage;
    try {
      await saveGame(doc);
      setStgVal(null);
      setMsg({ kind: 'ok', text: `${sg.opp} marked ${stage ? 'postseason' : 'regular season'}.` });
    } catch (e) {
      setMsg({ kind: 'err', text: `Couldn't save (${errText(e)}).` });
    }
  };
  const del = async () => {
    if (!dg) return;
    try {
      await deleteGame(dg.id);
      setConfirm(false);
      setDelId('');
      setMsg({ kind: 'ok', text: `Removed ${dg.opp}.` });
    } catch (e) {
      setMsg({ kind: 'err', text: `Couldn't remove (${errText(e)}).` });
    }
  };
  const opts = games.map((g) => <option key={g.id} value={g.id}>{g.date} · {g.opp}</option>);

  return (
    <section className="panel">
      <h2>Export and manage</h2>
      <div className="form">
        <button type="button" className="btn" onClick={() => exp(() => gamesToCsv(games))}>Download all games (CSV)</button>
        <button type="button" className="btn" onClick={() => exp(() => boardToJson(games, roster, loads))}>Download all data (JSON)</button>
      </div>
      {games.length > 0 && (
        <>
          <div className="form" style={{ marginTop: 12 }}>
            <div className="field"><span className="label">Season stage</span>
              <select value={sg?.id ?? ''} onChange={(e) => { setStgId(e.target.value); setStgVal(null); }}>{opts}</select></div>
            <div className="field"><span className="label">&nbsp;</span>
              <select value={stage} onChange={(e) => setStgVal(e.target.value)}>
                <option value="">Regular season</option><option value="Postseason">Postseason</option>
              </select></div>
            <button type="button" className="btn" onClick={saveStage}>Save stage</button>
          </div>
          <div className="form" style={{ marginTop: 12 }}>
            <div className="field"><span className="label">Remove a game</span>
              <select value={dg?.id ?? ''} onChange={(e) => { setDelId(e.target.value); setConfirm(false); }}>{opts}</select></div>
            <button type="button" className="btn danger" onClick={() => setConfirm(true)}>Remove</button>
            {confirm && dg && (
              <span>
                <span className="warn">Remove {dg.opp} ({dg.date})?</span>{' '}
                <button type="button" className="btn danger" onClick={del}>Yes, remove</button>{' '}
                <button type="button" className="btn" onClick={() => setConfirm(false)}>Cancel</button>
              </span>
            )}
          </div>
        </>
      )}
      <Status msg={msg} />
    </section>
  );
}
