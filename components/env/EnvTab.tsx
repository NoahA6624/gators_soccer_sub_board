'use client';
// Environment tab shell: factor switcher + match/result filters (renderEnv head, L1808–1814).
import { useMemo } from 'react';
import { useBoard } from '@/lib/data/board';
import { buildNameIndex, playerLabel, posOf } from '@/lib/engine';
import type { Result } from '@/lib/types';
import { TipHost } from './Tip';
import { Seg } from './Seg';
import { PanelBoundary } from './ErrorBoundary';
import { CondEditor } from './CondEditor';
import { FactorView } from './FactorView';
import { ImpactCheck, ScenarioView } from './Scenario';
import { EFACT, egrpOf, EGRP, env, ENV_DEFAULT, FACTOR_KEYS, RES_OPTS, type EnvMode, type EnvUi } from './envUtil';

export function EnvTab() {
  const { games: raw, roster, canEdit, loading, ui, setUi } = useBoard();
  const games = useMemo(() => [...raw].sort((a, b) => a.date.localeCompare(b.date)), [raw]);
  const idx = useMemo(() => buildNameIndex(games, roster), [games, roster]);
  const u: EnvUi = { ...ENV_DEFAULT, ...((ui.env as Partial<EnvUi>) ?? {}) };
  const set = (p: Partial<EnvUi>) => setUi('env', { ...u, ...p });
  const lab = (p: string) => playerLabel(p, idx);
  const pos = (p: string) => { try { return posOf(p, games, roster); } catch { return roster[p]?.pos ?? ''; } };

  const EG = egrpOf(u.egrp);
  const all = useMemo(() => games.filter((g) => EG[2](g, games) && (u.eres === 'All' || g.result === u.eres)), [games, u.egrp, u.eres]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="panel empty">Loading…</div>;
  if (!games.length) return <div className="panel empty">No matches yet.{canEdit ? ' Add one in Add data.' : ''}</div>;

  const modes: [EnvMode, string][] = [...FACTOR_KEYS.map((k) => [k, EFACT[k].label] as [EnvMode, string]), ['scn', 'Match scenario'], ['chk', 'Impact check']];
  const isFactor = u.efac !== 'scn' && u.efac !== 'chk';
  const heatMissing = games.some((g) => env(g).heat == null);
  const condEditor = canEdit ? <CondEditor games={games} open={u.eopen || (u.efac === 'heat' && heatMissing)} setOpen={(v) => { if (v !== u.eopen) set({ eopen: v }); }} /> : null;
  const egrps = u.efac === 'chk' ? EGRP.filter((x) => !/^last/.test(x[0])) : EGRP;

  return (
    <TipHost>
      <div className="stack">
        <section className="panel">
          <div className="filters" style={{ marginBottom: 6 }}>
            <Seg label="Factor" value={u.efac} options={modes} onChange={(v) => set({ efac: v })} />
            {(u.efac === 'heat' || u.efac === 'scn' || u.efac === 'chk') && (
              <Seg label="Hot = at or above" value={u.eheat} options={[80, 85, 90, 95].map((v) => [v, `${v}°F`] as [number, string])} onChange={(v) => set({ eheat: v })} />
            )}
            <div className="field"><span className="label">{u.efac === 'chk' ? 'Projection uses' : 'Matches'}</span>
              <select value={u.egrp} onChange={(e) => set({ egrp: e.target.value })}>
                {egrps.map(([k, l, fn]) => <option key={k} value={k}>{l}{u.efac === 'chk' ? '' : ` (${games.filter((g) => fn(g, games)).length})`}</option>)}
              </select></div>
            <div className="field"><span className="label">Result</span>
              <select value={u.eres} onChange={(e) => set({ eres: e.target.value as 'All' | Result })}>
                {RES_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></div>
          </div>
          {isFactor && <p className="note" style={{ margin: 0 }}>{EFACT[u.efac as keyof typeof EFACT].why} Full-match minutes and spells from the sub data.</p>}
        </section>
        <PanelBoundary what="this view" key={u.efac}>
          {isFactor && <FactorView u={u} set={set} all={all} games={games} canEdit={canEdit} lab={lab} posOf={pos} condEditor={condEditor} />}
          {u.efac === 'scn' && <ScenarioView u={u} set={set} games={all} lab={lab} />}
          {u.efac === 'chk' && <ImpactCheck u={u} set={set} games={games} lab={lab} />}
        </PanelBoundary>
        {!isFactor && condEditor}
      </div>
    </TipHost>
  );
}
