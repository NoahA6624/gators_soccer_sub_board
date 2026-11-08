'use client';
// Roster editor (L1518 "Missing positions", extended): position, jersey number and first name.
import { useMemo, useState } from 'react';
import { buildNameIndex, playerLabel, posOf } from '@/lib/engine';
import { saveRoster } from '@/lib/data/mutations';
import type { Game, Pos, Roster } from '@/lib/types';
import { errText, Status, useMsg } from './Status';

type Row = { pos: Pos; num: string; first: string };

export function RosterEditor({ games, roster }: { games: Game[]; roster: Roster }) {
  const idx = useMemo(() => buildNameIndex(games, roster), [games, roster]);
  const players = useMemo(() => {
    const s = new Set<string>(Object.keys(roster));
    games.forEach((g) => [...g.lineup.starters, ...g.lineup.bench].forEach((p) => s.add(p.name)));
    const safePos = (p: string) => { try { return posOf(p, games, roster); } catch { return roster[p]?.pos ?? ''; } };
    return [...s].map((p) => ({ p, cur: safePos(p) })).sort((a, b) => (a.cur ? 1 : 0) - (b.cur ? 1 : 0) || a.p.localeCompare(b.p));
  }, [games, roster]);
  const [edit, setEdit] = useState<Record<string, Row>>({});
  const [msg, setMsg] = useMsg();
  const [busy, setBusy] = useState(false);
  const missing = players.filter((x) => !x.cur).length;

  const rowOf = (p: string, cur: string): Row => edit[p] ?? {
    pos: (roster[p]?.pos ?? cur ?? '') as Pos,
    num: roster[p]?.num ?? idx[p]?.num ?? '',
    first: roster[p]?.first ?? idx[p]?.first ?? '',
  };

  const save = async () => {
    const out: Roster = { ...roster };
    let n = 0;
    for (const [p, r] of Object.entries(edit)) {
      const next = { ...(out[p] ?? { pos: '' as Pos }), pos: r.pos } as Roster[string];
      if (r.num.trim()) next.num = r.num.trim().replace(/^#/, ''); else delete next.num;
      if (r.first.trim()) next.first = r.first.trim(); else delete next.first;
      out[p] = next;
      n++;
    }
    if (!n) { setMsg({ kind: 'muted', text: 'No changes.' }); return; }
    setBusy(true);
    try {
      await saveRoster(out);
      setEdit({});
      setMsg({ kind: 'ok', text: `Saved ${n} player${n > 1 ? 's' : ''}.` });
    } catch (e) {
      setMsg({ kind: 'err', text: `Couldn't save (${errText(e)}).` });
    } finally {
      setBusy(false);
    }
  };

  if (!players.length) return null;
  return (
    <section className="panel">
      <details open={missing > 0}>
        <summary><b>Roster</b> · positions, numbers and first names{missing ? <> · <span className="warn">{missing} missing a position</span></> : null}</summary>
        <p className="note">Positions are box-score labels unless set here. Number and first name fill or override the box score everywhere a player is shown.</p>
        <div className="tablewrap"><table>
          <thead><tr><th style={{ textAlign: 'left' }}>Player</th><th>Pos</th><th>#</th><th>First name</th></tr></thead>
          <tbody>
            {players.map(({ p, cur }) => {
              const r = rowOf(p, cur);
              const upd = (patch: Partial<Row>) => setEdit({ ...edit, [p]: { ...r, ...patch } });
              return (
                <tr key={p}>
                  <td style={{ textAlign: 'left' }}><span className="pname">{playerLabel(p, idx)}</span>{!cur && <span className="warn"> · no position</span>}</td>
                  <td><select value={r.pos} onChange={(e) => upd({ pos: e.target.value as Pos })}>
                    <option value="">—</option>{['GK', 'DEF', 'MID', 'FWD'].map((x) => <option key={x}>{x}</option>)}
                  </select></td>
                  <td><input value={r.num} onChange={(e) => upd({ num: e.target.value })} style={{ width: 56 }} inputMode="numeric" /></td>
                  <td><input value={r.first} onChange={(e) => upd({ first: e.target.value })} style={{ width: 130 }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <div className="form" style={{ marginTop: 10 }}>
          <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save roster'}</button>
          <Status msg={msg} />
        </div>
      </details>
    </section>
  );
}
