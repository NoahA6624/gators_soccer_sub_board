'use client';
// Review/edit one parsed game before saving (renderPending, L1542–1567).
import { useMemo, useState } from 'react';
import { clk, halfD, isSEC, RES, slug } from '@/lib/engine';
import { saveGame } from '@/lib/data/mutations';
import { FetchWeather } from '@/components/env/useWeather';
import type { Game, GameEnv } from '@/lib/types';
import { errText } from './Status';

export interface Pending {
  key: string;
  game: Game;
  file?: string;
  warnings?: string[];
}

const recalc = (g: Game): Game => ({ ...g, result: g.gf > g.ga ? 'W' : g.gf < g.ga ? 'L' : 'T' });

export function PendingGame({ p, exists, onChange, onDrop, onSaved }: {
  p: Pending;
  exists: boolean;
  onChange: (g: Game) => void;
  onDrop: () => void;
  onSaved: (g: Game) => void;
}) {
  const g = p.game;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const d = useMemo(() => {
    try {
      return halfD(g, 1);
    } catch {
      return null;
    }
  }, [g]);
  const e = g.env ?? {};
  const ht = g.ht ?? { uf: 0, opp: 0 };
  const set = (patch: Partial<Game>) => onChange({ ...g, ...patch });
  const setEnv = (k: keyof GameEnv, v: string) => {
    const env: GameEnv = { ...(g.env ?? {}) };
    if (v === '') delete env[k];
    else (env as Record<string, unknown>)[k] = k === 'kickoff' ? v : +v;
    onChange({ ...g, env });
  };
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const doc: Game = { ...g, addedAt: new Date().toISOString() };
      if (!doc.stage) delete doc.stage;
      await saveGame(doc);
      onSaved(doc);
    } catch (x) {
      setErr(`Couldn't save (${errText(x)}).`);
      setBusy(false);
    }
  };
  const starters = g.lineup?.starters?.length ?? 0;
  return (
    <div className="panel" style={{ background: 'var(--surface-2)' }}>
      <div className="gamehead" style={{ marginBottom: 10 }}>
        <div className="score" style={{ fontSize: 24 }}>Florida <b>{g.gf}–{g.ga}</b> {g.opp}</div>
        <div className="meta">
          <span className={`pill ${g.result}`}>{RES[g.result]}</span>
          <span className="tnum">{g.date} · HT {ht.uf}–{ht.opp}</span>
          {g.source && <span className="pill plain">{String(g.source).toUpperCase()}</span>}
          {exists && <span className="pill plain">Replaces saved game</span>}
        </div>
      </div>
      {p.warnings?.length ? (
        <div className="warn" style={{ marginBottom: 10 }}>{p.warnings.map((w, i) => <div key={i}>{w}</div>)}</div>
      ) : null}
      <div className="form">
        <div className="field"><span className="label">Opponent</span>
          <input value={g.opp} onChange={(x) => set({ opp: x.target.value, id: `${g.date}-${slug(x.target.value)}` })} /></div>
        <div className="field"><span className="label">Date</span>
          <input type="date" value={g.date} onChange={(x) => set({ date: x.target.value, id: `${x.target.value}-${slug(g.opp)}` })} /></div>
        <div className="field"><span className="label">Venue</span>
          <select value={g.venue} onChange={(x) => set({ venue: x.target.value as Game['venue'] })}>
            {['Home', 'Away', 'Neutral'].map((v) => <option key={v}>{v}</option>)}
          </select></div>
        <div className="field"><span className="label">Opponent level</span>
          <select value={g.tier} onChange={(x) => set({ tier: x.target.value })}>
            {['P4', 'Non-P4'].map((v) => <option key={v}>{v}</option>)}
          </select></div>
        <div className="field"><span className="label">Conference game</span>
          <select value={isSEC(g) ? 'SEC' : 'Non-conf'} onChange={(x) => set({ conf: x.target.value })}>
            <option value="SEC">SEC</option><option value="Non-conf">Non-conference</option>
          </select></div>
        {g.source === 'manual' && (
          <>
            <div className="field"><span className="label">Final (UF–Opp)</span><span>
              <input type="number" min={0} value={g.gf} onChange={(x) => onChange(recalc({ ...g, gf: +x.target.value }))} />{' '}
              <input type="number" min={0} value={g.ga} onChange={(x) => onChange(recalc({ ...g, ga: +x.target.value }))} />
            </span></div>
            <div className="field"><span className="label">Halftime</span><span>
              <input type="number" min={0} value={ht.uf} onChange={(x) => set({ ht: { ...ht, uf: +x.target.value } })} />{' '}
              <input type="number" min={0} value={ht.opp} onChange={(x) => set({ ht: { ...ht, opp: +x.target.value } })} />
            </span></div>
          </>
        )}
        <div className="field"><span className="label">Season stage</span>
          <select value={g.stage === 'Postseason' ? 'Postseason' : ''} onChange={(x) => set({ stage: x.target.value || undefined })}>
            <option value="">Regular season</option><option value="Postseason">Postseason</option>
          </select></div>
        <div className="field"><span className="label">Kickoff (local)</span>
          <input type="time" value={e.kickoff ?? ''} onChange={(x) => setEnv('kickoff', x.target.value)} /></div>
        <div className="field"><span className="label">Temp °F</span>
          <input type="number" value={e.tempF ?? ''} onChange={(x) => setEnv('tempF', x.target.value)} style={{ width: 80 }} /></div>
        <div className="field"><span className="label">Dew pt °F</span>
          <input type="number" value={e.dewF ?? ''} onChange={(x) => setEnv('dewF', x.target.value)} style={{ width: 80 }} /></div>
        <div className="field"><span className="label">UV</span>
          <input type="number" min={0} max={15} value={e.uv ?? ''} onChange={(x) => setEnv('uv', x.target.value)} style={{ width: 70 }} /></div>
        <div className="field"><span className="label">Weather</span>
          <FetchWeather game={g} onApply={(env) => onChange({ ...g, env: { ...env, kickoff: g.env?.kickoff || env.kickoff } })} /></div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}><span className="label">Note</span>
          <input value={g.notes ?? ''} placeholder="Injury, red card, weather…" onChange={(x) => set({ notes: x.target.value })} /></div>
      </div>
      <p className="note" style={{ margin: '10px 0' }}>
        {starters} starters, {g.lineup?.bench?.length ?? 0} bench · <b>{d?.subs.length ?? '—'}</b> 1st-half subs (first {clk(d?.first)}) · {g.events?.length ?? 0} events logged
        {starters !== 11 && <> · <span className="warn">Starters should be 11</span></>}
        {p.file && <> · <span className="dim">{p.file}</span></>}
      </p>
      <div className="form">
        <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : exists ? 'Replace game' : 'Save game'}</button>
        <button type="button" className="btn" disabled={busy} onClick={onDrop}>Discard</button>
        {err && <span className="err">{err}</span>}
      </div>
    </div>
  );
}
