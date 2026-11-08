'use client';
// condCards (L1721), heatChart (L1730), envRankPanel (L1761) for the Environment tab.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type ReactNode } from 'react';
import { downloadBlob, envRankPdf } from '@/lib/export';
import type { Game } from '@/lib/types';
import { useTip } from './Tip';
import { EFACT, eLab, env, ERT, ERTF, k12, sgn, vsAt, type FactorKey } from './envUtil';

type Agg = Record<string, any>;
const R = (v: unknown) => (typeof v === 'number' && !isNaN(v) ? Math.round(v) : '—');

export function CondCards({ all, games, fk, eheat }: { all: Game[]; games: Game[]; fk: FactorKey; eheat: number }) {
  const tip = useTip();
  const f = EFACT[fk];
  return (
    <div className="econd">
      {all.map((g) => {
        const e = env(g), k = f.grp(g, games, eheat);
        return (
          <div key={g.id} className={`ecard ${k ? 'g' + k : 'gx'}`} {...tip(<>
            <b>{vsAt(g)} {g.opp}</b> · {g.date}<br />{g.location || g.venue}<br />Kickoff {k12(e.kmin)} local
            {e.rh != null && <><br />Humidity {R(e.rh)}%</>}<br />
            {k ? <b>{eLab(fk, k, eheat)}</b> : 'Not classified: missing data'}
          </>)}>
            <div className="ed tnum">{g.date.slice(5).replace('-', '/')} <span className={`res-${g.result}`}>{g.result} {g.gf}–{g.ga}</span></div>
            <div className="eo">{vsAt(g)} {g.opp}</div>
            <div className="ek">{e.night == null ? <span className="dim">Kickoff —</span> : <><span className="eic">{e.night ? '☾' : '☀'}</span> {k12(e.kmin)}</>}</div>
            {e.T != null ? (
              <div className="ewx">
                <span>{R(e.T)}°F</span>
                {e.D != null && <span>dew {R(e.D)}°</span>}
                {e.hi != null && <span><b>HI {R(e.hi)}°</b></span>}
                {e.uv != null && <span>UV {e.uv}</span>}
              </div>
            ) : <div className="ewx dim">No weather yet</div>}
          </div>
        );
      })}
    </div>
  );
}

export function HeatChart({ all, eheat }: { all: Game[]; eheat: number }) {
  const tip = useTip();
  const pts = all.map((g) => ({ g, e: env(g) })).filter((x) => typeof x.e.heat === 'number');
  if (!pts.length) return null;
  const W = 760, H = 220, l = 40, r = 10, t = 14, b = 46;
  const vals = pts.map((x) => x.e.heat as number);
  const lo = Math.min(70, Math.floor(Math.min(...vals) / 5) * 5), hi = Math.max(eheat + 5, Math.ceil(Math.max(...vals) / 5) * 5);
  const y = (v: number) => t + (H - t - b) * (1 - (v - lo) / (hi - lo));
  const bw = Math.min(46, ((W - l - r) / pts.length) * 0.6), x = (i: number) => l + ((W - l - r) * (i + 0.5)) / pts.length;
  const grid: ReactNode[] = [];
  for (let v = lo; v <= hi; v += 5) grid.push(
    <g key={v}><line x1={l} x2={W - r} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--faint)">{v}°</text></g>,
  );
  return (
    <section className="panel">
      <h3>Temperature at kickoff · °F{pts.some((p) => p.e.basis === 'Heat index') ? ' (* = heat index)' : ''}{' '}
        <span style={{ color: 'var(--orange)', letterSpacing: 0, textTransform: 'none', fontWeight: 600 }}>- - - hot cut-off {eheat}°</span></h3>
      <div className="chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Heat index by match">
          {grid}
          {pts.map((p, i) => {
            const hot = p.e.heat >= eheat;
            return (
              <g key={p.g.id}>
                <rect x={x(i) - bw / 2} y={y(p.e.heat)} width={bw} height={y(lo) - y(p.e.heat)} rx="4" fill={hot ? 'var(--orange)' : 'var(--bench-st)'}
                  {...tip(<><b>{p.g.opp}</b> · {p.g.date}<br />{p.e.basis} {R(p.e.heat)}°F
                    {p.e.D != null && <><br />Temp {R(p.e.T)}° · dew {R(p.e.D)}° · RH {R(p.e.rh)}%</>}
                    {p.e.uv != null && <><br />UV {p.e.uv}</>}</>)} />
                <text x={x(i)} y={y(p.e.heat) - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink)">{R(p.e.heat)}{p.e.basis === 'Heat index' ? '*' : ''}</text>
                <text x={x(i)} y={H - b + 16} textAnchor="middle" fontSize="11" fill="var(--muted)">{p.g.opp.length > 9 ? p.g.opp.slice(0, 8) + '…' : p.g.opp}</text>
                <text x={x(i)} y={H - b + 30} textAnchor="middle" fontSize="10.5" fill="var(--faint)">{p.e.night ? '☾' : '☀'} {k12(p.e.kmin)}</text>
              </g>
            );
          })}
          <line x1={l} x2={W - r} y1={y(eheat)} y2={y(eheat)} stroke="var(--orange)" strokeDasharray="5 4" strokeWidth="1.5" />
        </svg>
      </div>
    </section>
  );
}

/** Ranked "who plays more in condition B" panel with perspective flip + coach PDF (L1759–1798). */
export function EnvRank({ fk, rows0, label, nA0, nB0, flip, setFlip, lab }: {
  fk: FactorKey; rows0: Agg[]; label: string; nA0: number; nB0: number; flip: boolean;
  setFlip: (v: boolean) => void; lab: (p: string) => string;
}) {
  const tip = useTip();
  const [st, setSt] = useState<{ cls: string; text: string } | null>(null);
  if (!rows0.length) return null;
  const t = flip ? ERTF[fk] : ERT[fk];
  const rows = rows0.map((r) => (flip ? { ...r, a: r.b, b: r.a, na: r.nb, nb: r.na, d: r.a - r.b } : r)).sort((x, y) => y.d - x.d);
  const nA = flip ? nB0 : nA0, nB = flip ? nA0 : nB0;
  const mx = Math.max(10, ...rows.map((r) => Math.abs(r.d || 0)));
  const pdf = async () => {
    setSt({ cls: '', text: 'Building PDF…' });
    try {
      const named = rows.map((r) => ({ ...r, label: lab(r.p) }));
      downloadBlob(await envRankPdf(named, label));
      setSt({ cls: 'ok', text: 'PDF downloaded.' });
    } catch (e) {
      setSt({ cls: 'err', text: (e as Error).message });
    }
  };
  return (
    <section className="panel">
      <div className="gamehead" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>{t[0]}</h2>
        <div className="form">
          <div className="fgroup"><span className="label">Perspective</span><div className="seg" role="group">
            <button type="button" aria-pressed={!flip} onClick={() => setFlip(false)}>{ERT[fk][3]}</button>
            <button type="button" aria-pressed={flip} onClick={() => setFlip(true)}>{ERTF[fk][3]}</button>
          </div></div>
          <button type="button" className="btn primary" onClick={pdf}>Download PDF for coaches</button>
        </div>
      </div>
      <p className="note" style={{ margin: '0 0 10px' }}>
        {label} · {nB} {t[3].toLowerCase()} vs {nA} {t[4].toLowerCase()} · minutes per match played · ranked from most extra minutes {t[1]} to fewest.{' '}
        {st && <span className="status"><span className={st.cls}>{st.text}</span></span>}
      </p>
      <div className="erank">
        <div className="er-h"><span>#</span><span>Player</span><span>{t[4]}</span><span>{t[3]}</span><span className="er-mid"><em>← less {t[1]}</em><em>more {t[1]} →</em></span><span>Diff</span></div>
        {rows.map((r, i) => {
          const w = Math.min(50, (Math.abs(r.d || 0) / mx) * 50);
          return (
            <div key={r.p} className={`er-r${r.thin ? ' thin' : ''}`} {...tip(<>
              <b>{lab(r.p)}</b><br />{t[4]}: {R(r.a)}&apos; per match ({r.na} played)<br />{t[3]}: {R(r.b)}&apos; per match ({r.nb} played)
              {r.thin && <><br /><i>Fewer than 2 matches on one side</i></>}
            </>)}>
              <span className="tnum dim">{i + 1}</span>
              <span><b>{lab(r.p)}</b>{r.gk && <> <span className="pos">GK</span></>}</span>
              <span className="tnum">{R(r.a)}&apos;<small> ·{r.na}</small></span>
              <span className="tnum">{R(r.b)}&apos;<small> ·{r.nb}</small></span>
              <span className="er-bar"><i style={r.d >= 0 ? { left: '50%', width: `${w}%`, background: 'var(--orange)' } : { right: '50%', width: `${w}%`, background: 'var(--bench-st)' }} /><b /></span>
              <span className={`tnum er-d ${r.d >= 3 ? 'delta-dn' : r.d <= -3 ? 'delta-up' : ''}`}>{sgn(r.d)}</span>
            </div>
          );
        })}
      </div>
      <p className="note" style={{ marginTop: 8 }}>Diff = {t[3].toLowerCase()} minus {t[4].toLowerCase()}, per match played. Small number after each average = matches played. Faded rows have fewer than 2 matches on one side. Only players who played both {t[3].toLowerCase()} and {t[4].toLowerCase()} matches are listed.</p>
    </section>
  );
}
