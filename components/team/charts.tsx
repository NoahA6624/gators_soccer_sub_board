'use client';
// Team charts: histo (L847), stateBars (L863), windowRows (L869), rotationMap (L937), freshChart (L947).
import { dm, playerLabel, sum, type Agg, type NameIndex } from '@/lib/engine';
import { arr, isNum, useTip } from '@/components/ui';

const per90 = (n: number, m: number) => (m > 0 ? (n / m) * 90 : null);

export function Histo({ T, idx }: { T: Agg; idx: NameIndex }) {
  const tip = useTip();
  const bins = arr(T.bins);
  const lo = T.lo ?? 0, hi = T.hi ?? 45;
  const W = 640, H = 300, pl = 30, pr = 10, pt = 26, pb = 30;
  const max = Math.max(1, ...bins.map((b) => b.n ?? 0));
  const bw = (W - pl - pr) / Math.max(1, bins.length);
  const sy = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  const step = max <= 6 ? 1 : max <= 15 ? 3 : Math.ceil(max / 5);
  const grid: number[] = [];
  for (let v = 0; v <= max; v += step) grid.push(v);
  const fx = isNum(T.first) ? pl + (W - pl - pr) * ((T.first - lo) / (hi - lo)) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Subs by 5-minute window" style={{ width: '100%' }}>
      {grid.map((v) => (
        <g key={v}>
          <line x1={pl} x2={W - pr} y1={sy(v)} y2={sy(v)} stroke="var(--line)" />
          <text x={pl - 6} y={sy(v) + 4} textAnchor="end" fontSize={11} fill="var(--faint)">{v}</text>
        </g>
      ))}
      {bins.map((b, i) => {
        const n = b.n ?? 0;
        const x = pl + i * bw + 5, w = bw - 10, h = sy(0) - sy(n);
        const offs: Record<string, string[]> = {};
        arr(b.list).forEach((s) => { (offs[s.off] = offs[s.off] || []).push(s.g?.opp ?? ''); });
        const rows = Object.entries(offs).sort((a, c) => c[1].length - a[1].length);
        const tp = tip(
          <>
            <b>{b.a}–{b.a + 5}&apos;</b> · {n} sub{n === 1 ? '' : 's'} made
            {n > 0 && (
              <div className="tl">
                {rows.map(([p, gs]) => [
                  <span key={p + 'a'}>{playerLabel(p, idx)} <span style={{ opacity: 0.7 }}>{gs.join(', ')}</span></span>,
                  <span key={p + 'b'}>{gs.length}×</span>,
                ])}
              </div>
            )}
          </>,
        );
        return (
          <g key={i}>
            <rect x={pl + i * bw} y={pt} width={bw} height={sy(0) - pt} fill="transparent" {...tp} />
            <rect x={x} y={sy(n)} width={w} height={h} rx={4} fill="var(--orange)" {...tp} />
            {n > 0 && <text x={x + w / 2} y={sy(n) - 6} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--ink)" pointerEvents="none">{n}</text>}
            <text x={x + w / 2} y={H - 10} textAnchor="middle" fontSize={12} fill="var(--faint)">{b.a}&apos;</text>
          </g>
        );
      })}
      {fx != null && (
        <>
          <line x1={fx} x2={fx} y1={pt - 14} y2={sy(0)} stroke="var(--blue)" strokeWidth={2} strokeDasharray="5 4" />
          <text x={fx + 5} y={pt - 4} fontSize={12} fontWeight={700} fill="var(--blue)">avg first sub {dm(T.first)}</text>
        </>
      )}
    </svg>
  );
}

const SC: Record<string, string> = { Winning: 'var(--win)', Level: 'var(--tie)', Losing: 'var(--loss)' };
const SL: Record<string, string> = { Winning: 'ahead', Level: 'level', Losing: 'behind' };

export function StateBars({ T }: { T: Agg }) {
  const tip = useTip();
  const st = arr(T.state);
  const tot = sum(st.map((s) => s.n ?? 0));
  if (!tot) return <p className="note">No subs in these games.</p>;
  return (
    <>
      <p style={{ margin: '0 0 10px', fontSize: 14.5 }}>Of <b>{tot}</b> subs, the score was:</p>
      <div style={{ display: 'flex', height: 30, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
        {st.filter((s) => s.n).map((s) => (
          <div key={s.k}
            style={{ flex: s.n, background: SC[s.k], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, minWidth: 0 }}
            {...tip(<><b>{s.n} subs while {SL[s.k]}</b> · {Math.round((s.n / tot) * 100)}% · avg at {dm(s.avg)}</>)}>
            {s.n / tot >= 0.12 ? Math.round((s.n / tot) * 100) + '%' : ''}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
        {st.map((s) => (
          <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, opacity: s.n ? undefined : 0.5 }}>
            <i className="sw" style={{ background: SC[s.k] }} />
            <b style={{ minWidth: 92 }}>We were {SL[s.k]}</b>
            <span className="tnum">{s.n ? `${s.n} subs · usually around ${isNum(s.avg) ? Math.round(s.avg) : '—'}'` : 'never'}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function WindowRows({ T }: { T: Agg }) {
  const win = arr(T.win);
  const max = Math.max(1, ...win.flatMap((w) => [w.u ?? 0, w.o ?? 0]));
  const bar = (v: number, col: string) => (
    <div style={{ height: 10, borderRadius: 5, background: 'var(--track)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${((v ?? 0) / max) * 100}%`, background: col, borderRadius: 5 }} />
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {win.map((w) => (
        <div key={w.a} style={{ display: 'grid', gridTemplateColumns: '62px 1fr', gap: 10, alignItems: 'center' }}>
          <div>
            <b className="tnum">{w.a}–{w.b}&apos;</b>
            <div className="dim" style={{ fontSize: 12 }}>{w.s ?? 0} sub{w.s === 1 ? '' : 's'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 26px', gap: '4px 8px', alignItems: 'center', fontSize: 12.5 }}>
            <span className="muted">Us</span>{bar(w.u, 'var(--blue)')}<b className="tnum">{w.u ?? 0}</b>
            <span className="muted">Them</span>{bar(w.o, 'var(--opp)')}<b className="tnum">{w.o ?? 0}</b>
            <span className="muted">Goals</span><span className="tnum">{w.gu ?? 0} for · {w.go ?? 0} against</span><span />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RotationMap({ FP, n, idx, limit = 24 }: { FP: Agg[]; n: number; idx: NameIndex; limit?: number }) {
  const tip = useTip();
  const rows = FP.filter((r) => (r.g ?? 0) > 0).sort((a, b) => sum(arr<number>(b.mins)) - sum(arr<number>(a.mins))).slice(0, limit);
  const W = 900, rh = 22, lw = 150, top = 18, H = top + rows.length * rh + 22, bw = (W - lw - 8) / 18;
  const ticks = [0, 3, 6, 9, 12, 15, 18];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rotation map">
      {ticks.map((b) => <text key={b} x={lw + b * bw} y={top - 6} textAnchor="middle" fontSize={11} fill="var(--faint)">{b * 5}&apos;</text>)}
      {rows.map((r, i) => {
        const y = top + i * rh;
        const label = playerLabel(r.p, idx);
        return (
          <g key={r.p}>
            <text x={lw - 8} y={y + 15} textAnchor="end" fontSize={12.5} fontWeight={600} fill="var(--ink)">{label}</text>
            {arr<number>(r.occ).map((v, b) => {
              const sh = n ? Math.min(1, (v || 0) / (5 * n)) : 0;
              return (
                <g key={b}>
                  <rect x={lw + b * bw + 1} y={y + 2} width={bw - 2} height={rh - 4} rx={3} fill="var(--track)" />
                  <rect x={lw + b * bw + 1} y={y + 2} width={bw - 2} height={rh - 4} rx={3} fill="var(--blue)" fillOpacity={+(sh * 0.95).toFixed(2)}
                    {...tip(<><b>{label}</b> {b * 5}–{b * 5 + 5}&apos;<br />On the field in {Math.round(sh * 100)}% of these games</>)} />
                </g>
              );
            })}
          </g>
        );
      })}
      <line x1={lw + 9 * bw} x2={lw + 9 * bw} y1={top - 2} y2={top + rows.length * rh} stroke="var(--orange)" strokeWidth={2} />
      <text x={lw + 9 * bw + 4} y={H - 6} fontSize={11} fontWeight={700} fill="var(--orange)">Halftime</text>
    </svg>
  );
}

export function FreshChart({ W: Win }: { W: Agg[] | undefined }) {
  const rows: Agg[] = arr(Win).map((w): Agg => ({ ...w, F: per90(w.f ?? 0, w.expo ?? 0), A: per90(w.a ?? 0, w.expo ?? 0) }));
  if (!rows.length) return <p className="note">No spell data yet.</p>;
  const max = Math.max(1, ...rows.flatMap((r) => [r.F || 0, r.A || 0]));
  const Wd = 560, H = 240, pl = 30, pb = 40, pt = 16, gw = (Wd - pl - 10) / rows.length;
  const sy = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  const step = max > 16 ? 5 : 2;
  const grid: number[] = [];
  for (let v = 0; v <= max; v += step) grid.push(v);
  return (
    <svg viewBox={`0 0 ${Wd} ${H}`} role="img" aria-label="Team shots per 90 by minutes into a spell" style={{ width: '100%' }}>
      {grid.map((v) => (
        <g key={v}>
          <line x1={pl} x2={Wd - 10} y1={sy(v)} y2={sy(v)} stroke="var(--line)" />
          <text x={pl - 6} y={sy(v) + 4} textAnchor="end" fontSize={11} fill="var(--faint)">{v}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const x = pl + i * gw + gw * 0.16, bw = gw * 0.32;
        return (
          <g key={i}>
            {r.F != null && (
              <>
                <rect x={x} y={sy(r.F)} width={bw} height={sy(0) - sy(r.F)} rx={3} fill="var(--blue)" />
                <text x={x + bw / 2} y={sy(r.F) - 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ink)">{r.F.toFixed(1)}</text>
              </>
            )}
            {r.A != null && (
              <>
                <rect x={x + bw + 4} y={sy(r.A)} width={bw} height={sy(0) - sy(r.A)} rx={3} fill="var(--opp)" />
                <text x={x + bw * 1.5 + 4} y={sy(r.A) - 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ink)">{r.A.toFixed(1)}</text>
              </>
            )}
            <text x={x + bw + 2} y={H - 22} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--ink)">{r.l}</text>
            <text x={x + bw + 2} y={H - 8} textAnchor="middle" fontSize={10.5} fill="var(--faint)">{Math.round(r.expo ?? 0)} player-min</text>
          </g>
        );
      })}
    </svg>
  );
}
