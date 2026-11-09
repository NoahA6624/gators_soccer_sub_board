// "Typical match lane" SVGs (port of laneMarks/laneSVG/laneAxis, L813–836).
//
//   <LaneSVG r={fullPlayerStatsRow} width={560} height={40} labels />
//     Filled area = share of games on the field per minute (r.occM[m] / r.g); blue if starter, orange if bench.
//     With labels: ▼ typical exit / ▲ typical entry markers with "off ~38'" text.
//   <LaneAxis width={560} />   0' 15' 30' HT 60' 75' 90' tick labels (put in the table header cell).
//   laneMarks(r)               -> [{t, k:'on'|'off', l}] used by LaneSVG.
//   LANE_LEGEND                <div class="legend"> explaining the lane colours.
import { avg, type Agg } from '@/lib/engine';
import { arr, isNum } from './util';

export interface LaneMark { t: number; k: 'on' | 'off'; l: string }

export function laneMarks(r: Agg): LaneMark[] {
  const m: LaneMark[] = [];
  const g = r.g ?? 0, starts = r.starts ?? 0;
  const entry = arr<number>(r.entry), exit1 = arr<number>(r.exit1), retLate = arr<number>(r.retLate), exit2 = arr<number>(r.exit2);
  const isSt = starts >= g / 2;
  const e = avg(entry);
  if (!isSt && entry.length && isNum(e)) m.push({ t: e, k: 'on', l: `on ~${Math.round(e)}'` });
  if (isSt && exit1.length >= Math.max(1, starts / 2) && isNum(r.exit1A)) m.push({ t: r.exit1A, k: 'off', l: `off ~${Math.round(r.exit1A)}'` });
  if (retLate.length >= Math.max(1, g / 2) && isNum(r.retLateA)) m.push({ t: r.retLateA, k: 'on', l: `back ~${Math.round(r.retLateA)}'` });
  else if ((r.retHT ?? 0) >= Math.max(1, g / 2)) m.push({ t: 45, k: 'on', l: 'back at HT' });
  const x = avg(exit2);
  if (exit2.length >= Math.max(1, g / 2) && isNum(x)) m.push({ t: x, k: 'off', l: `off ~${Math.round(x)}'` });
  return m;
}

export function LaneSVG({ r, width = 560, height = 40, labels = true }: { r: Agg; width?: number; height?: number; labels?: boolean }) {
  const W = width, H = height;
  const x0 = 2, x1 = W - 2, sx = (m: number) => x0 + (x1 - x0) * (Math.min(m, 90) / 90);
  const top = labels ? 13 : 3, base = H - 3, hgt = base - top;
  const g = r.g || 0;
  const col = (r.starts ?? 0) >= g / 2 ? 'var(--blue)' : 'var(--orange)';
  let d = `M${sx(0)} ${base}`;
  arr<number>(r.occM).forEach((v, m) => {
    const y = base - hgt * (g ? Math.min(1, (v || 0) / g) : 0);
    d += ` L${sx(m)} ${y} L${sx(m + 1)} ${y}`;
  });
  d += ` L${sx(90)} ${base} Z`;
  const marks: { x: number; mk: LaneMark; text: number | null }[] = [];
  if (labels) {
    let lastX = -99;
    laneMarks(r).forEach((mk) => {
      const x = sx(mk.t);
      const tx = Math.min(W - 40, Math.max(4, x + 6));
      let text: number | null = null;
      if (tx - lastX > 58) { text = tx; lastX = tx; }
      marks.push({ x, mk, text });
    });
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" style={{ width: '100%', height: H, display: 'block' }}>
      <rect x={x0} y={top} width={x1 - x0} height={hgt} rx={3} fill="var(--track)" />
      <path d={d} fill={col} fillOpacity={0.88} />
      {[15, 30, 60, 75].map((t) => (
        <line key={t} x1={sx(t)} x2={sx(t)} y1={top} y2={base} stroke="var(--surface)" strokeWidth={1} strokeOpacity={0.7} />
      ))}
      <line x1={sx(45)} x2={sx(45)} y1={top - 2} y2={base} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="3 2" strokeOpacity={0.55} />
      {marks.map(({ x, mk, text }, i) => (
        <g key={i}>
          <path d={mk.k === 'off' ? `M${x - 4} ${top - 7} l4 5 l4 -5z` : `M${x - 4} ${top - 2} l4 -5 l4 5z`} fill={mk.k === 'off' ? 'var(--orange)' : 'var(--win)'} />
          {text != null && <text x={text} y={top - 3} fontSize={10.5} fontWeight={700} fill="var(--muted)">{mk.l}</text>}
        </g>
      ))}
    </svg>
  );
}

export function LaneAxis({ width = 560 }: { width?: number }) {
  const W = width, x0 = 2, x1 = W - 2, sx = (m: number) => x0 + (x1 - x0) * (m / 90);
  return (
    <svg viewBox={`0 0 ${W} 14`} preserveAspectRatio="none" aria-hidden="true" style={{ width: '100%', height: 14, display: 'block' }}>
      {[0, 15, 30, 45, 60, 75, 90].map((t) => (
        <text key={t} x={Math.min(W - 12, Math.max(8, sx(t)))} y={11} textAnchor="middle" fontSize={10} fill="var(--faint)" fontWeight={t === 45 ? 700 : undefined}>
          {t === 45 ? 'HT' : t + "'"}
        </text>
      ))}
    </svg>
  );
}

export function LaneLegend() {
  return (
    <div className="legend">
      <span><i className="sw" style={{ background: 'var(--blue)' }} />Starter</span>
      <span><i className="sw" style={{ background: 'var(--orange)' }} />Mostly off the bench</span>
      <span>Height = share of games she&apos;s on the field at that minute (full height = every game)</span>
      <span><b style={{ color: 'var(--orange)' }}>▼</b> typical exit · <b style={{ color: 'var(--win)' }}>▲</b> typical entry / return</span>
      <span>Hover a row for the full pattern</span>
    </div>
  );
}
