'use client';
// renderProfile (L1361–1413): inline player drill-down on the Players tab. Uses ALL games (not filtered), like the original.
import { useMemo } from 'react';
import { useBoard } from '@/lib/data/board';
import { avg, clk, dm, fullPlayerStats, HN, isSEC, patternText, playerLabel, playerStats, posOf, roleOf, type Agg, type NameIndex } from '@/lib/engine';
import type { Game, Scope } from '@/lib/types';
import { arr, byP, fx, isNum, LaneAxis, LaneSVG, OccStrip, rnd, safe, subMin, useTip } from '@/components/ui';
import { roleLabel } from './roles';

const CTX: [string, (g: Game) => boolean][] = [
  ['All', () => true], ['Power 4', (g) => g.tier === 'P4'], ['SEC', (g) => safe(() => isSEC(g), false)],
  ['Non-P4', (g) => g.tier === 'Non-P4'], ['Wins', (g) => g.result === 'W'], ['Ties', (g) => g.result === 'T'],
  ['Losses', (g) => g.result === 'L'], ['Home', (g) => g.venue === 'Home'], ['Away', (g) => g.venue !== 'Home'],
];

function SpellsByGame({ logs }: { logs: Agg[] }) {
  const tip = useTip();
  const gw = 560, lw = 130, rh = 18;
  const sx = (m: number, E: number) => lw + (gw - lw) * (m / (E || 90));
  return (
    <svg viewBox={`0 0 ${gw + 50} ${logs.length * rh + 22}`} role="img" aria-label="Spells by game" style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 15, 30, 45, 60, 75, 90].map((t) => (
        <text key={t} x={lw + (gw - lw) * (t / 90)} y={logs.length * rh + 16} textAnchor="middle" fontSize={10.5} fill="var(--faint)">{t}&apos;</text>
      ))}
      <line x1={sx(45, 90)} x2={sx(45, 90)} y1={0} y2={logs.length * rh} stroke="var(--orange)" strokeDasharray="3 3" />
      {logs.map((l, i) => {
        const y = i * rh;
        return (
          <g key={i}>
            <text x={lw - 8} y={y + 13} textAnchor="end" fontSize={11.5} fill="var(--ink)">{l.g?.result} · {l.g?.opp}</text>
            <rect x={lw} y={y + 4} width={gw - lw} height={rh - 8} rx={2} fill="var(--track)" />
            {arr<[number, number]>(l.sp).map(([a, b], j) => (
              <rect key={j} x={sx(a, l.END)} y={y + 3} width={Math.max(2, sx(b, l.END) - sx(a, l.END))} height={rh - 6} rx={3}
                fill={l.start ? 'var(--blue)' : 'var(--orange)'} {...tip(<>{l.g?.opp} · {clk(a)}–{clk(b)} ({Math.round(b - a)} min)</>)} />
            ))}
            <text x={gw + 46} y={y + 13} textAnchor="end" fontSize={11} fill="var(--faint)">{rnd(l.min)}&apos;</text>
          </g>
        );
      })}
    </svg>
  );
}

const nameList = (rec: Record<string, number> | undefined, idx: NameIndex) =>
  Object.entries(rec ?? {}).sort((a, b) => b[1] - a[1]).map(([q, k]) => `${playerLabel(q, idx)} ${k}×`).join(', ');

export function Profile({ p, scope, idx, onClose }: { p: string; scope: Scope; idx: NameIndex; onClose: () => void }) {
  const { games, loads, roster } = useBoard();
  const n = games.length;
  const FA: Agg | undefined = useMemo(() => byP(safe(() => fullPlayerStats(games, loads), {} as never))[p], [games, loads, p]);
  const ctxF = useMemo(
    () => (FA ? CTX.map(([l, fn]) => ({ l, r: byP(safe(() => fullPlayerStats(games.filter(fn), loads), {} as never))[p] })).filter((c) => c.r && c.r.g) : []),
    [FA, games, loads, p],
  );
  const h: 1 | 2 = scope === 'h2' ? 2 : 1;
  const r: Agg | undefined = useMemo(
    () => (scope === 'full' ? undefined : byP(safe(() => playerStats(games, h, loads), {} as never))[p]),
    [scope, games, h, loads, p],
  );
  const pos = safe(() => posOf(p, games, roster), '');

  let shape = null;
  if (FA) {
    shape = (
      <>
        <div className="profile-typ">
          <h3>Typical match</h3>
          <LaneAxis width={760} />
          <LaneSVG r={FA} width={760} height={56} />
          <p style={{ fontSize: 15, margin: '8px 0 14px' }}><b>{safe(() => patternText(FA), '')}</b></p>
        </div>
        <div className="kpis4" style={{ marginBottom: 14 }}>
          <div className="kpi"><div className="v tnum">{rnd(FA.minPg)}</div><div className="k">Minutes per game ({FA.g} games)</div></div>
          <div className="kpi"><div className="v tnum">{fx(FA.spellPg)} <small>× {rnd(FA.spellLen)}&apos;</small></div><div className="k">Spells per game × avg length</div></div>
          <div className="kpi"><div className="v tnum">{FA.full90 ?? 0}</div><div className="k">Full 90s</div></div>
          <div className="kpi"><div className="v tnum">{fx(FA.hsr2Pm)}</div><div className="k">2H HSR per min{isNum(FA.hsr2Pm) ? '' : ' (add 2H GPS)'}</div></div>
        </div>
        <div className="grid2">
          <div>
            <h3>Every game · on the field</h3>
            <SpellsByGame logs={arr(FA.log)} />
            <div className="legend">
              <span><i className="sw" style={{ background: 'var(--blue)' }} />Started</span>
              <span><i className="sw" style={{ background: 'var(--orange)' }} />Off the bench</span>
              <span>Dashed = halftime</span>
            </div>
            <h3 style={{ marginTop: 14 }}>When she&apos;s on · share of games, 5-min blocks</h3>
            <OccStrip occ={FA.occ} n={n} width={420} />
          </div>
          <div>
            <h3>Timing by context</h3>
            <div className="tablewrap">
              <table>
                <thead><tr><th>Games</th><th>n</th><th>Min / g</th><th>Avg spell</th><th>1H off</th><th>2H back</th><th>Final off</th></tr></thead>
                <tbody>
                  {ctxF.map(({ l, r: c }) => (
                    <tr key={l}>
                      <td><b>{l}</b></td>
                      <td className="tnum">{c.g}</td>
                      <td className="tnum big">{rnd(c.minPg)}</td>
                      <td className="tnum">{rnd(c.spellLen)}&apos;</td>
                      <td className="tnum">{arr(c.exit1).length ? dm(c.exit1A) : '—'}</td>
                      <td className="tnum">
                        {arr(c.ret2).length
                          ? [c.retHT ? `HT ${c.retHT}×` : '', arr(c.retLate).length ? `${dm(c.retLateA)} (${arr(c.retLate).length}×)` : ''].filter(Boolean).join(' · ')
                          : '—'}
                      </td>
                      <td className="tnum">{arr(c.exit2).length ? dm(avg(arr<number>(c.exit2))) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">1H off = when she comes off as a starter · 2H back = return after being off at halftime (HT = at the restart) · Final off = last exit before full time.</p>
          </div>
        </div>
      </>
    );
  }

  let half = null;
  if (r) {
    const ctx = CTX.map(([l, fn]) => {
      const o = arr(r.offs).filter((x) => x.g && fn(x.g));
      const s = arr(r.log).filter((x) => x.role === 'Start' && x.g && fn(x.g)).length;
      const on = arr(r.ons).filter((x) => x.g && fn(x.g));
      return { l, s, o, on };
    }).filter((c) => c.s || c.on.length);
    const repl = nameList(r.repl, idx), rep2 = nameList(r.replaced, idx);
    const logs = arr(r.log);
    const hasL = logs.some((l) => l.load);
    const hn = HN[h === 1 ? 'h1' : 'h2'], sl = h === 2 ? 'On at restart' : 'Starts';
    half = (
      <>
        <h2 style={{ marginTop: 24 }}>{hn}</h2>
        <div className="kpis4" style={{ marginBottom: 14 }}>
          <div className="kpi"><div className="v tnum">{arr(r.offs).length ? dm(r.avgOff) : '—'}</div><div className="k">Avg sub-off when on at the {h === 2 ? 'restart' : 'start'}</div></div>
          <div className="kpi"><div className="v tnum">{r.full ?? 0}<small> / {r.starts ?? 0}</small></div><div className="k">Played the full half</div></div>
          <div className="kpi"><div className="v tnum">{arr(r.ons).length ? dm(r.avgOn) : '—'}</div><div className="k">Avg entry off the bench</div></div>
          <div className="kpi"><div className="v tnum">{fx(r.hsrPm)}</div><div className="k">{h}H HSR per min{isNum(r.hsrPm) ? '' : ' (add GPS)'}</div></div>
        </div>
        <div className="grid2">
          <div>
            <h3>By context</h3>
            <div className="tablewrap">
              <table>
                <thead><tr><th>Games</th><th>{sl}</th><th>Off</th><th>Avg off</th><th>Entries</th><th>Avg on</th></tr></thead>
                <tbody>
                  {ctx.map((c) => (
                    <tr key={c.l}>
                      <td><b>{c.l}</b></td>
                      <td className="tnum">{c.s}</td>
                      <td className="tnum">{c.o.length}</td>
                      <td className="tnum big">{dm(avg(c.o.map(subMin)))}</td>
                      <td className="tnum">{c.on.length}</td>
                      <td className="tnum">{dm(avg(c.on.map(subMin)))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">{repl ? `Replaced by: ${repl}. ` : ''}{rep2 ? `Comes on for: ${rep2}.` : ''}</p>
          </div>
          <div>
            <h3>Game log · {hn}</h3>
            <div className="tablewrap">
              <table>
                <thead><tr><th>Game</th><th>Role</th><th>On</th><th>Off</th><th>Min</th>{hasL && <><th>Dist/min</th><th>HSR/min</th></>}</tr></thead>
                <tbody>
                  {logs.map((l, i) => {
                    const min = isNum(l.min) ? l.min : 0;
                    return (
                      <tr key={i}>
                        <td><span className={`res-${l.g?.result}`}>{l.g?.result}</span> {l.g?.opp}</td>
                        <td>{l.role === 'Start' ? (h === 2 ? 'On at restart' : 'Start') : 'Bench'}</td>
                        <td className="tnum">{clk(l.on)}</td>
                        <td className="tnum">{min > 0 ? (l.off != null ? clk(l.off) : 'End') : '—'}</td>
                        <td className="tnum">{min.toFixed(1)}</td>
                        {hasL && (
                          <>
                            <td className="tnum">{isNum(l.load?.dist) && min > 0 ? (l.load.dist / min).toFixed(0) : '—'}</td>
                            <td className="tnum">{isNum(l.load?.hsr) && min > 0 ? (l.load.hsr / min).toFixed(1) : '—'}</td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="profile-head">
        <div>
          <div className="nm">{playerLabel(p, idx)}</div>
          <div className="meta" style={{ marginTop: 6 }}>
            {pos && <span className="pill plain">{pos}</span>}
            {FA && (
              <>
                <span className="pill plain">{roleLabel(safe(() => roleOf(FA), ''))}</span>
                <span>Season: {FA.g} games · {FA.starts ?? 0} starts</span>
              </>
            )}
          </div>
        </div>
        <button type="button" className="linkbtn" onClick={onClose}>Close</button>
      </div>
      {shape}
      {half}
      {!FA && !r && <p className="note">No minutes recorded for this player yet.</p>}
    </section>
  );
}
