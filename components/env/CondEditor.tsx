'use client';
// Match conditions editor (condEditor L1872, save L1894–1902). Editors only; writes via saveGame.
import { useState } from 'react';
import { saveGame } from '@/lib/data/mutations';
import type { Game, GameEnv } from '@/lib/types';
import { FetchWeather } from './useWeather';
import { env, vsAt } from './envUtil';

type EK = 'kickoff' | 'tempF' | 'dewF' | 'uv';
type Draft = Record<string, Partial<Record<EK, string>>>;

export function CondEditor({ games, open, setOpen }: { games: Game[]; open: boolean; setOpen: (v: boolean) => void }) {
  const [draft, setDraft] = useState<Draft>({});
  const [fetched, setFetched] = useState<Record<string, GameEnv>>({});
  const [busy, setBusy] = useState(false);
  const [st, setSt] = useState<{ cls: string; text: string } | null>(null);

  const val = (g: Game, k: EK) => {
    const d = draft[g.id]?.[k];
    if (d != null) return d;
    const v = (fetched[g.id] ?? g.env ?? {})[k];
    return v == null ? '' : String(v);
  };
  const set = (g: Game, k: EK, v: string) => setDraft((p) => ({ ...p, [g.id]: { ...p[g.id], [k]: v } }));

  const save = async () => {
    const changed: Game[] = [];
    for (const g of games) {
      const old = g.env ?? {};
      const next: GameEnv = { ...old, ...(fetched[g.id] ?? {}) };
      let dirty = !!fetched[g.id];
      for (const k of ['kickoff', 'tempF', 'dewF', 'uv'] as EK[]) {
        const d = draft[g.id]?.[k];
        if (d == null) continue;
        const v = k === 'kickoff' ? d || null : d === '' ? null : +d;
        if ((old[k] ?? null) !== v) { (next as Record<string, unknown>)[k] = v; dirty = true; }
      }
      if (!dirty) continue;
      if (!fetched[g.id]) next.src = 'manual';
      (Object.keys(next) as (keyof GameEnv)[]).forEach((k) => { if (next[k] == null) delete next[k]; });
      changed.push({ ...g, env: next });
    }
    if (!changed.length) { setSt({ cls: 'muted', text: 'No changes.' }); return; }
    setBusy(true);
    setSt({ cls: '', text: 'Saving…' });
    try {
      for (const g of changed) await saveGame(g);
      setDraft({});
      setFetched({});
      setSt({ cls: 'ok', text: `Saved ${changed.length} match${changed.length > 1 ? 'es' : ''}.` });
    } catch (e) {
      const x = e as { code?: string; message?: string };
      setSt({ cls: 'err', text: `Couldn't save (${x.code || x.message}).` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <details open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>Match conditions (edit)</summary>
        <p className="note">Kickoff is local time at the venue. Enter the temperature at kickoff (°F), or use <b>Fetch weather</b> to fill it from Open-Meteo for the kickoff hour. Dew point and peak UV are optional; with a dew point the heat index is worked out and used for the Heat split.</p>
        <div className="tablewrap"><table>
          <thead><tr><th>Match</th><th>Kickoff (local)</th><th>Temp °F</th><th>Dew point °F</th><th>UV index</th><th>Heat index</th><th>Weather</th></tr></thead>
          <tbody>
            {games.map((g) => {
              const v = env(g);
              return (
                <tr key={g.id}>
                  <td>{g.date.slice(5)} {vsAt(g)} {g.opp}</td>
                  <td><input type="time" value={val(g, 'kickoff')} onChange={(e) => set(g, 'kickoff', e.target.value)} /></td>
                  <td><input type="number" step={1} value={val(g, 'tempF')} onChange={(e) => set(g, 'tempF', e.target.value)} style={{ width: 70 }} /></td>
                  <td><input type="number" step={1} value={val(g, 'dewF')} onChange={(e) => set(g, 'dewF', e.target.value)} style={{ width: 70 }} /></td>
                  <td><input type="number" step={1} min={0} max={15} value={val(g, 'uv')} onChange={(e) => set(g, 'uv', e.target.value)} style={{ width: 60 }} /></td>
                  <td className="tnum">{typeof v.hi === 'number' ? Math.round(v.hi) + '°' : <span className="dim">—</span>}</td>
                  <td>
                    <FetchWeather
                      game={{ ...g, env: { ...(g.env ?? {}), kickoff: val(g, 'kickoff') || g.env?.kickoff } }}
                      onApply={(e2) => {
                        setFetched((p) => ({ ...p, [g.id]: { ...e2, kickoff: val(g, 'kickoff') || e2.kickoff } }));
                        setDraft((p) => { const n = { ...p }; if (n[g.id]) n[g.id] = { kickoff: n[g.id].kickoff }; return n; });
                      }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <div className="form" style={{ marginTop: 10 }}>
          <button type="button" className="btn primary" disabled={busy} onClick={save}>Save conditions</button>
          {st && <span className="status"><span className={st.cls}>{st.text}</span></span>}
        </div>
      </details>
    </section>
  );
}
